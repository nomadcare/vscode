/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import type * as vscode from 'vscode';
import { Emitter, Event } from '../../../base/common/event.js';
import { MainContext, MainThreadAuthenticationShape, ExtHostAuthenticationShape } from './extHost.protocol.js';
import { Disposable } from './extHostTypes.js';
import { IExtensionDescription, ExtensionIdentifier } from '../../../platform/extensions/common/extensions.js';
import { INTERNAL_AUTH_PROVIDER_PREFIX } from '../../services/authentication/common/authentication.js';
import { createDecorator } from '../../../platform/instantiation/common/instantiation.js';
import { IExtHostRpcService } from './extHostRpcService.js';
import { URI } from '../../../base/common/uri.js';
import { fetchDynamicRegistration, getClaimsFromJWT, IAuthorizationJWTClaims, IAuthorizationServerMetadata, IAuthorizationTokenResponse, isAuthorizationTokenResponse } from '../../../base/common/oauth.js';
import { IExtHostWindow } from './extHostWindow.js';
import { IExtHostInitDataService } from './extHostInitDataService.js';
import { ILogger, ILoggerService } from '../../../platform/log/common/log.js';
import { derived, IObservable, ISettableObservable, observableValue } from '../../../base/common/observable.js';
import { stringHash } from '../../../base/common/hash.js';
import { DisposableStore, isDisposable } from '../../../base/common/lifecycle.js';
import { IExtHostUrlsService } from './extHostUrls.js';
import { encodeBase64, VSBuffer } from '../../../base/common/buffer.js';

export interface IExtHostAuthentication extends ExtHostAuthentication { }
export const IExtHostAuthentication = createDecorator<IExtHostAuthentication>('IExtHostAuthentication');

interface ProviderWithMetadata {
	label: string;
	provider: vscode.AuthenticationProvider;
	disposable?: vscode.Disposable;
	options: vscode.AuthenticationProviderOptions;
}

export class ExtHostAuthentication implements ExtHostAuthenticationShape {

	declare _serviceBrand: undefined;

	private _proxy: MainThreadAuthenticationShape;
	private _authenticationProviders: Map<string, ProviderWithMetadata> = new Map<string, ProviderWithMetadata>();

	private _onDidChangeSessions = new Emitter<vscode.AuthenticationSessionsChangeEvent & { extensionIdFilter?: string[] }>();
	private _getSessionTaskSingler = new TaskSingler<vscode.AuthenticationSession | undefined>();

	private _onDidDynamicAuthProviderTokensChange = new Emitter<{ authProviderId: string; clientId: string; tokens: IAuthorizationToken[] }>();

	constructor(
		@IExtHostRpcService extHostRpc: IExtHostRpcService,
		@IExtHostInitDataService private readonly _initData: IExtHostInitDataService,
		@IExtHostWindow private readonly _extHostWindow: IExtHostWindow,
		@IExtHostUrlsService private readonly _extHostUrls: IExtHostUrlsService,
		@ILoggerService private readonly _extHostLoggerService: ILoggerService,
	) {
		this._proxy = extHostRpc.getProxy(MainContext.MainThreadAuthentication);
	}

	/**
	 * This sets up an event that will fire when the auth sessions change with a built-in filter for the extensionId
	 * if a session change only affects a specific extension.
	 * @param extensionId The extension that is interested in the event.
	 * @returns An event with a built-in filter for the extensionId
	 */
	getExtensionScopedSessionsEvent(extensionId: string): Event<vscode.AuthenticationSessionsChangeEvent> {
		const normalizedExtensionId = extensionId.toLowerCase();
		return Event.chain(this._onDidChangeSessions.event, ($) => $
			.filter(e => !e.extensionIdFilter || e.extensionIdFilter.includes(normalizedExtensionId))
			.map(e => ({ provider: e.provider }))
		);
	}

	async getSession(requestingExtension: IExtensionDescription, providerId: string, scopes: readonly string[], options: vscode.AuthenticationGetSessionOptions & ({ createIfNone: true } | { forceNewSession: true } | { forceNewSession: vscode.AuthenticationForceNewSessionOptions })): Promise<vscode.AuthenticationSession>;
	async getSession(requestingExtension: IExtensionDescription, providerId: string, scopes: readonly string[], options: vscode.AuthenticationGetSessionOptions & { forceNewSession: true }): Promise<vscode.AuthenticationSession>;
	async getSession(requestingExtension: IExtensionDescription, providerId: string, scopes: readonly string[], options: vscode.AuthenticationGetSessionOptions & { forceNewSession: vscode.AuthenticationForceNewSessionOptions }): Promise<vscode.AuthenticationSession>;
	async getSession(requestingExtension: IExtensionDescription, providerId: string, scopes: readonly string[], options: vscode.AuthenticationGetSessionOptions): Promise<vscode.AuthenticationSession | undefined>;
	async getSession(requestingExtension: IExtensionDescription, providerId: string, scopes: readonly string[], options: vscode.AuthenticationGetSessionOptions = {}): Promise<vscode.AuthenticationSession | undefined> {
		const extensionId = ExtensionIdentifier.toKey(requestingExtension.identifier);
		const sortedScopes = [...scopes].sort().join(' ');
		const keys: (keyof vscode.AuthenticationGetSessionOptions)[] = Object.keys(options) as (keyof vscode.AuthenticationGetSessionOptions)[];
		const optionsStr = keys.sort().map(key => `${key}:${!!options[key]}`).join(', ');
		return await this._getSessionTaskSingler.getOrCreate(`${extensionId} ${providerId} ${sortedScopes} ${optionsStr}`, async () => {
			await this._proxy.$ensureProvider(providerId);
			const extensionName = requestingExtension.displayName || requestingExtension.name;
			return this._proxy.$getSession(providerId, scopes, extensionId, extensionName, options);
		});
	}

	async getAccounts(providerId: string) {
		await this._proxy.$ensureProvider(providerId);
		return await this._proxy.$getAccounts(providerId);
	}

	async removeSession(providerId: string, sessionId: string): Promise<void> {
		const providerData = this._authenticationProviders.get(providerId);
		if (!providerData) {
			return this._proxy.$removeSession(providerId, sessionId);
		}

		return providerData.provider.removeSession(sessionId);
	}

	registerAuthenticationProvider(id: string, label: string, provider: vscode.AuthenticationProvider, options?: vscode.AuthenticationProviderOptions): vscode.Disposable {
		if (this._authenticationProviders.get(id)) {
			throw new Error(`An authentication provider with id '${id}' is already registered.`);
		}

		this._authenticationProviders.set(id, { label, provider, options: options ?? { supportsMultipleAccounts: false } });
		const listener = provider.onDidChangeSessions(e => this._proxy.$sendDidChangeSessions(id, e));
		this._proxy.$registerAuthenticationProvider(id, label, options?.supportsMultipleAccounts ?? false, options?.supportedIssuers);

		return new Disposable(() => {
			listener.dispose();
			this._authenticationProviders.delete(id);
			this._proxy.$unregisterAuthenticationProvider(id);
			if (isDisposable(provider)) {
				provider.dispose();
			}
		});
	}

	async $createSession(providerId: string, scopes: string[], options: vscode.AuthenticationProviderSessionOptions): Promise<vscode.AuthenticationSession> {
		const providerData = this._authenticationProviders.get(providerId);
		if (providerData) {
			options.issuer = URI.revive(options.issuer);
			return await providerData.provider.createSession(scopes, options);
		}

		throw new Error(`Unable to find authentication provider with handle: ${providerId}`);
	}

	async $removeSession(providerId: string, sessionId: string): Promise<void> {
		const providerData = this._authenticationProviders.get(providerId);
		if (providerData) {
			return await providerData.provider.removeSession(sessionId);
		}

		throw new Error(`Unable to find authentication provider with handle: ${providerId}`);
	}

	async $getSessions(providerId: string, scopes: ReadonlyArray<string> | undefined, options: vscode.AuthenticationProviderSessionOptions): Promise<ReadonlyArray<vscode.AuthenticationSession>> {
		const providerData = this._authenticationProviders.get(providerId);
		if (providerData) {
			options.issuer = URI.revive(options.issuer);
			return await providerData.provider.getSessions(scopes, options);
		}

		throw new Error(`Unable to find authentication provider with handle: ${providerId}`);
	}

	$onDidChangeAuthenticationSessions(id: string, label: string, extensionIdFilter?: string[]) {
		// Don't fire events for the internal auth providers
		if (!id.startsWith(INTERNAL_AUTH_PROVIDER_PREFIX)) {
			this._onDidChangeSessions.fire({ provider: { id, label }, extensionIdFilter });
		}
		return Promise.resolve();
	}

	async $registerDynamicAuthProvider(serverMetadata: IAuthorizationServerMetadata, clientId?: string, initialTokens?: IAuthorizationToken[]): Promise<void> {
		const issuerUri = URI.parse(serverMetadata.issuer);
		const provider = await DynamicAuthProvider.create(
			this._extHostWindow,
			this._extHostUrls,
			this._initData,
			this._proxy,
			this._extHostLoggerService.createLogger(serverMetadata.issuer, { name: issuerUri.authority }),
			serverMetadata,
			this._onDidDynamicAuthProviderTokensChange,
			{ clientId, initialTokens }
		);
		const disposable = provider.onDidChangeSessions(e => this._proxy.$sendDidChangeSessions(serverMetadata.issuer, e));
		this._authenticationProviders.set(
			serverMetadata.issuer,
			{
				label: issuerUri.authority,
				provider,
				disposable: Disposable.from(provider, disposable),
				options: { supportsMultipleAccounts: false }
			}
		);
		await this._proxy.$registerDynamicAuthenticationProvider(serverMetadata.issuer, issuerUri.authority, issuerUri, provider.clientId);
	}

	async $onDidChangeDynamicAuthProviderTokens(authProviderId: string, clientId: string, tokens: IAuthorizationToken[]): Promise<void> {
		this._onDidDynamicAuthProviderTokensChange.fire({ authProviderId, clientId, tokens });
	}
}

class TaskSingler<T> {
	private _inFlightPromises = new Map<string, Promise<T>>();
	getOrCreate(key: string, promiseFactory: () => Promise<T>) {
		const inFlight = this._inFlightPromises.get(key);
		if (inFlight) {
			return inFlight;
		}

		const promise = promiseFactory().finally(() => this._inFlightPromises.delete(key));
		this._inFlightPromises.set(key, promise);

		return promise;
	}
}

export class DynamicAuthProvider implements vscode.AuthenticationProvider {
	private _onDidChangeSessions = new Emitter<vscode.AuthenticationProviderAuthenticationSessionsChangeEvent>();
	readonly onDidChangeSessions = this._onDidChangeSessions.event;

	private readonly _tokenStore: TokenStore;

	private readonly _createFlows: Array<(scopes: string[]) => Promise<IAuthorizationTokenResponse>>;

	private readonly _disposable: DisposableStore;

	constructor(
		@IExtHostWindow private readonly _extHostWindow: IExtHostWindow,
		@IExtHostUrlsService private readonly _extHostUrls: IExtHostUrlsService,
		@IExtHostInitDataService private readonly _initData: IExtHostInitDataService,
		private readonly _proxy: MainThreadAuthenticationShape,
		private readonly _logger: ILogger,
		private readonly _serverMetadata: IAuthorizationServerMetadata,
		readonly clientId: string,
		scopedEvent: Event<IAuthorizationToken[]>,
		initialTokens: IAuthorizationToken[],
	) {
		this._disposable = new DisposableStore();
		this._disposable.add(this._onDidChangeSessions);
		this._tokenStore = this._disposable.add(new TokenStore(
			{
				onDidChange: scopedEvent,
				set: (tokens) => _proxy.$setSessionsForDynamicAuthProvider(this._serverMetadata.issuer, this.clientId, tokens),
			},
			initialTokens
		));
		// Will be extended later to support other flows
		this._createFlows = [scopes => this._createWithUrlHandler(scopes)];
	}

	static async create(
		@IExtHostWindow extHostWindow: IExtHostWindow,
		@IExtHostUrlsService extHostUrls: IExtHostUrlsService,
		@IExtHostInitDataService initData: IExtHostInitDataService,
		proxy: MainThreadAuthenticationShape,
		logger: ILogger,
		serverMetadata: IAuthorizationServerMetadata,
		onDidDynamicAuthProviderTokensChange: Emitter<{ authProviderId: string; clientId: string; tokens: IAuthorizationToken[] }>,
		existingState: { clientId?: string; initialTokens?: IAuthorizationToken[] } = {},
	): Promise<DynamicAuthProvider> {
		let { clientId, initialTokens } = existingState;
		try {
			if (!clientId) {
				if (!serverMetadata.registration_endpoint) {
					throw new Error('Server does not support dynamic registration');
				}
				const registration = await fetchDynamicRegistration(serverMetadata.registration_endpoint, initData.environment.appName);
				clientId = registration.client_id;
			}
			const scopedEvent = Event.chain(onDidDynamicAuthProviderTokensChange.event, $ => $
				.filter(e => e.authProviderId === serverMetadata.issuer && e.clientId === clientId)
				.map(e => e.tokens)
			);
			const provider = new DynamicAuthProvider(
				extHostWindow,
				extHostUrls,
				initData,
				proxy,
				logger,
				serverMetadata,
				clientId,
				scopedEvent,
				initialTokens || []
			);
			return provider;
		} catch (err) {
			throw new Error(`Dynamic registration failed: ${err.message}`);
		}
	}

	async getSessions(scopes: readonly string[] | undefined, options: vscode.AuthenticationProviderSessionOptions): Promise<vscode.AuthenticationSession[]> {
		if (!scopes) {
			return this._tokenStore.sessions || [];
		}
		const sessions = this._tokenStore.sessions?.filter(session => session.scopes.join(' ') === scopes.join(' ')) || [];
		if (sessions.length) {
			const newTokens: IAuthorizationToken[] = [];
			const removedTokens: IAuthorizationToken[] = [];
			const newSessions: vscode.AuthenticationSession[] = [];
			const removedSessions: vscode.AuthenticationSession[] = [];
			const tokenMap = new Map<string, IAuthorizationToken>(this._tokenStore.tokens!.map(token => [token.access_token, token]));
			for (const session of sessions) {
				const token = tokenMap.get(session.accessToken);
				if (token && token.expires_in) {
					const now = Date.now();
					const expiresInMS = token.expires_in * 1000;
					// Check if the token is about to expire in 5 minutes or if it is expired
					if (now > token.created_at + expiresInMS - (5 * 60 * 1000)) {
						removedTokens.push(token);
						removedSessions.push(session);
						if (!token.refresh_token) {
							// No refresh token available, cannot refresh
							continue;
						}
						try {
							const newToken = await this.exchangeRefreshTokenForToken(token.refresh_token);
							newTokens.push(newToken);
							newSessions.push(this._getSessionFromToken(newToken));
						} catch (err) {
							this._logger.error(`Failed to refresh token: ${err}`);
						}

					}
				}
			}
			if (newTokens.length || removedTokens.length) {
				this._tokenStore.update({ added: newTokens, removed: removedTokens });
				this._onDidChangeSessions.fire({
					added: newSessions,
					removed: removedSessions,
					changed: []
				});
			}
			return sessions;
		}
		return [];
	}

	async createSession(scopes: string[], _options: vscode.AuthenticationProviderSessionOptions): Promise<vscode.AuthenticationSession> {
		let token: IAuthorizationTokenResponse | undefined;
		for (const createFlow of this._createFlows) {
			try {
				token = await createFlow(scopes);
				if (token) {
					break;
				}
			} catch (err) {
				this._logger.error(`Failed to create token: ${err}`);
			}
		}
		if (!token) {
			throw new Error('Failed to create authentication token');
		}

		// Store session for later retrieval
		this._tokenStore.update({ added: [{ ...token, created_at: Date.now() }], removed: [] });
		const session = this._tokenStore.sessions?.find(t => t.accessToken === token.access_token)!;

		// Notify that sessions have changed
		this._onDidChangeSessions.fire({ added: [session], removed: [], changed: [] });

		return session;
	}

	async removeSession(sessionId: string): Promise<void> {
		const session = this._tokenStore.sessions?.find(session => session.id === sessionId);
		if (!session) {
			this._logger.error(`Session with id ${sessionId} not found`);
			return;
		}
		const token = this._tokenStore.tokens?.find(token => token.access_token === session.accessToken);
		if (!token) {
			this._logger.error(`Failed to retrieve token for removed session: ${session.id}`);
			return;
		}
		this._tokenStore.update({ added: [], removed: [token] });
		this._onDidChangeSessions.fire({ added: [], removed: [session], changed: [] });
	}

	dispose(): void {
		this._disposable.dispose();
	}

	private async _createWithUrlHandler(scopes: string[]): Promise<IAuthorizationTokenResponse> {
		// Generate PKCE code verifier (random string) and code challenge (SHA-256 hash of verifier)
		const codeVerifier = this.generateRandomString(64);
		const codeChallenge = await this.generateCodeChallenge(codeVerifier);

		// Generate a random state value to prevent CSRF
		const nonce = this.generateRandomString(32);
		const issuer = URI.parse(this._serverMetadata.issuer);
		const callbackUri = URI.parse(`${this._initData.environment.appUriScheme}://dynamicauthprovider/${issuer.authority}/authorize?nonce=${nonce}`);
		let state: URI;
		try {
			state = await this._extHostUrls.createAppUri(callbackUri);
		} catch (error) {
			throw new Error(`Failed to create external URI: ${error}`);
		}

		// Prepare the authorization request URL
		const authorizationUrl = new URL(this._serverMetadata.authorization_endpoint!);
		authorizationUrl.searchParams.append('client_id', this.clientId);
		authorizationUrl.searchParams.append('response_type', 'code');
		authorizationUrl.searchParams.append('scope', scopes.join(' '));
		authorizationUrl.searchParams.append('state', state.toString());
		authorizationUrl.searchParams.append('code_challenge', codeChallenge);
		authorizationUrl.searchParams.append('code_challenge_method', 'S256');

		// Use a redirect URI that matches what was registered during dynamic registration
		const redirectUri = 'https://vscode.dev/redirect';
		authorizationUrl.searchParams.append('redirect_uri', redirectUri);

		const promise = this.waitForAuthorizationCode(callbackUri);

		// Open the browser for user authorization
		await this._extHostWindow.openUri(authorizationUrl.toString(), {});

		// Wait for the authorization code via a redirect
		const { code } = await promise;

		if (!code) {
			throw new Error('Authentication failed: No authorization code received');
		}

		// Exchange the authorization code for tokens
		const tokenResponse = await this.exchangeCodeForToken(code, codeVerifier, redirectUri);
		return tokenResponse;
	}

	protected generateRandomString(length: number): string {
		const array = new Uint8Array(length);
		crypto.getRandomValues(array);
		return Array.from(array)
			.map(b => b.toString(16).padStart(2, '0'))
			.join('')
			.substring(0, length);
	}

	protected async generateCodeChallenge(codeVerifier: string): Promise<string> {
		const encoder = new TextEncoder();
		const data = encoder.encode(codeVerifier);
		const digest = await crypto.subtle.digest('SHA-256', data);

		// Base64url encode the digest
		return encodeBase64(VSBuffer.wrap(new Uint8Array(digest)), false, false)
			.replace(/\+/g, '-')
			.replace(/\//g, '_')
			.replace(/=+$/, '');
	}

	private async waitForAuthorizationCode(expectedState: URI): Promise<{ code: string }> {
		const result = await this._proxy.$waitForUriHandler(expectedState);
		// Extract the code parameter directly from the query string. NOTE, URLSearchParams does not work here because
		// it will decode the query string and we need to keep it encoded.
		const codeMatch = /[?&]code=([^&]+)/.exec(result.query || '');
		if (!codeMatch || codeMatch.length < 2) {
			// No code parameter found in the query string
			throw new Error('Authentication failed: No authorization code received');
		}
		return { code: codeMatch[1] };
	}

	protected async exchangeCodeForToken(code: string, codeVerifier: string, redirectUri: string): Promise<IAuthorizationTokenResponse> {
		if (!this._serverMetadata.token_endpoint) {
			throw new Error('Token endpoint not available in server metadata');
		}

		const tokenRequest = new URLSearchParams();
		tokenRequest.append('client_id', this.clientId);
		tokenRequest.append('grant_type', 'authorization_code');
		tokenRequest.append('code', code);
		tokenRequest.append('redirect_uri', redirectUri);
		tokenRequest.append('code_verifier', codeVerifier);

		const response = await fetch(this._serverMetadata.token_endpoint, {
			method: 'POST',
			headers: {
				'Content-Type': 'application/x-www-form-urlencoded',
				'Accept': 'application/json'
			},
			body: tokenRequest.toString()
		});

		if (!response.ok) {
			const text = await response.text();
			throw new Error(`Token exchange failed: ${response.status} ${response.statusText} - ${text}`);
		}

		const result = await response.json();
		if (isAuthorizationTokenResponse(result)) {
			return result;
		}
		throw new Error(`Invalid authorization token response: ${JSON.stringify(result)}`);
	}

	protected async exchangeRefreshTokenForToken(refreshToken: string): Promise<IAuthorizationToken> {
		if (!this._serverMetadata.token_endpoint) {
			throw new Error('Token endpoint not available in server metadata');
		}

		const tokenRequest = new URLSearchParams();
		tokenRequest.append('client_id', this.clientId);
		tokenRequest.append('grant_type', 'refresh_token');
		tokenRequest.append('refresh_token', refreshToken);

		const response = await fetch(this._serverMetadata.token_endpoint, {
			method: 'POST',
			headers: {
				'Content-Type': 'application/x-www-form-urlencoded',
				'Accept': 'application/json'
			},
			body: tokenRequest.toString()
		});

		if (!response.ok) {
			const text = await response.text();
			throw new Error(`Token exchange failed: ${response.status} ${response.statusText} - ${text}`);
		}

		const result = await response.json();
		if (isAuthorizationTokenResponse(result)) {
			return {
				...result,
				created_at: Date.now(),
			};
		}
		throw new Error(`Invalid authorization token response: ${JSON.stringify(result)}`);
	}

	private _getSessionFromToken(token: IAuthorizationTokenResponse): vscode.AuthenticationSession {
		let claims: IAuthorizationJWTClaims | undefined;
		if (token.id_token) {
			try {
				claims = getClaimsFromJWT(token.id_token);
			} catch (e) {
				// log
			}
		}
		if (!claims) {
			try {
				claims = getClaimsFromJWT(token.access_token);
			} catch (e) {
				// log
			}
		}
		const scopes = token.scope
			? token.scope.split(' ')
			: claims?.scope
				? claims.scope.split(' ')
				: [];
		return {
			id: stringHash(token.access_token, 0).toString(),
			accessToken: token.access_token,
			account: {
				id: claims?.sub || 'unknown',
				label: claims?.preferred_username || claims?.name || claims?.email || 'Account',
			},
			scopes: scopes,
			idToken: token.id_token
		};
	}
}

type IAuthorizationToken = IAuthorizationTokenResponse & {
	/**
	 * The time when the token was created, in milliseconds since the epoch.
	 */
	created_at: number;
};

class TokenStore implements Disposable {
	private readonly _tokensObservable: ISettableObservable<IAuthorizationToken[]>;
	private readonly _sessionsObservable: IObservable<vscode.AuthenticationSession[]>;

	private readonly _disposable: DisposableStore;

	constructor(
		private readonly _persistence: { onDidChange: Event<IAuthorizationToken[]>; set: (tokens: IAuthorizationToken[]) => void },
		initialTokens: IAuthorizationToken[]
	) {
		this._disposable = new DisposableStore();
		this._tokensObservable = observableValue<IAuthorizationToken[]>('tokens', initialTokens);
		this._sessionsObservable = derived((reader) => this._tokensObservable.read(reader).map(t => this._getSessionFromToken(t)));
		this._disposable.add(this._persistence.onDidChange((tokens) => this._tokensObservable.set(tokens, undefined)));
	}

	get tokens(): IAuthorizationToken[] {
		return this._tokensObservable.get();
	}

	get sessions(): vscode.AuthenticationSession[] {
		return this._sessionsObservable.get();
	}

	dispose() {
		this._disposable.dispose();
	}

	update({ added, removed }: { added: IAuthorizationToken[]; removed: IAuthorizationToken[] }): void {
		const currentTokens = this._tokensObservable.get() || [];
		if (removed) {
			// remove from the array
			for (const token of removed) {
				const index = currentTokens.findIndex(t => t.access_token === token.access_token);
				if (index !== -1) {
					currentTokens.splice(index, 1);
				}
			}
		}
		if (added) {
			// add to the array
			for (const token of added) {
				const index = currentTokens.findIndex(t => t.access_token === token.access_token);
				if (index === -1) {
					currentTokens.push(token);
				} else {
					currentTokens[index] = token;
				}
			}
		}

		if (added || removed) {
			this._tokensObservable.set(currentTokens, undefined);
			void this._persistence.set(currentTokens);
		}
	}

	private _getSessionFromToken(token: IAuthorizationTokenResponse): vscode.AuthenticationSession {
		let claims: IAuthorizationJWTClaims | undefined;
		if (token.id_token) {
			try {
				claims = getClaimsFromJWT(token.id_token);
			} catch (e) {
				// log
			}
		}
		if (!claims) {
			try {
				claims = getClaimsFromJWT(token.access_token);
			} catch (e) {
				// log
			}
		}
		const scopes = token.scope
			? token.scope.split(' ')
			: claims?.scope
				? claims.scope.split(' ')
				: [];
		return {
			id: stringHash(token.access_token, 0).toString(),
			accessToken: token.access_token,
			account: {
				id: claims?.sub || 'unknown',
				label: claims?.preferred_username || claims?.name || claims?.email || 'Account',
			},
			scopes: scopes,
			idToken: token.id_token
		};
	}
}
