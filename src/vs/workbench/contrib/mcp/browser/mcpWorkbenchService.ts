/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { CancellationToken } from '../../../../base/common/cancellation.js';
import { Emitter } from '../../../../base/common/event.js';
import { Disposable } from '../../../../base/common/lifecycle.js';
import { IContextKeyService } from '../../../../platform/contextkey/common/contextkey.js';
import { IEditorOptions } from '../../../../platform/editor/common/editor.js';
import { IInstantiationService } from '../../../../platform/instantiation/common/instantiation.js';
import { DidUninstallMcpServerEvent, IGalleryMcpServer, ILocalMcpServer, IMcpGalleryService, IMcpManagementService, InstallMcpServerResult, IQueryOptions } from '../../../../platform/mcp/common/mcpManagement.js';
import { IWorkbenchContribution } from '../../../common/contributions.js';
import { ACTIVE_GROUP, IEditorService } from '../../../services/editor/common/editorService.js';
import { DefaultIconPath } from '../../../services/extensionManagement/common/extensionManagement.js';
import { HasInstalledMcpServersContext, IMcpWorkbenchService, IWorkbenchMcpServer } from '../common/mcpTypes.js';
import { McpServerEditorInput } from './mcpServerEditorInput.js';

class McpWorkbenchServer implements IWorkbenchMcpServer {

	constructor(
		public local: ILocalMcpServer | undefined,
		public gallery: IGalleryMcpServer | undefined,
	) {
	}

	get id(): string {
		return this.gallery?.id ?? this.local?.id ?? '';
	}

	get name(): string {
		return this.gallery?.name ?? this.local?.name ?? '';
	}

	get label(): string {
		return this.gallery?.displayName ?? this.local?.displayName ?? '';
	}

	get iconUrl(): string {
		return this.gallery?.iconUrl ?? this.local?.iconUrl ?? DefaultIconPath;
	}

	get publisherDisplayName(): string | undefined {
		return this.gallery?.publisherDisplayName ?? this.local?.publisherDisplayName ?? this.gallery?.publisher ?? this.local?.publisher;
	}

	get publisherUrl(): string | undefined {
		return this.gallery?.publisherDomain?.link;
	}

	get description(): string {
		return this.gallery?.description ?? this.local?.description ?? '';
	}

	get installCount(): number {
		return this.gallery?.installCount ?? 0;
	}

	get url(): string | undefined {
		return this.gallery?.url;
	}

	get repository(): string | undefined {
		return this.gallery?.repositoryUrl;
	}

	get readmeUrl(): string | undefined {
		return this.gallery?.readmeUrl ?? this.local?.readmeUrl;
	}

}

export class McpWorkbenchService extends Disposable implements IMcpWorkbenchService {

	_serviceBrand: undefined;

	private _local: McpWorkbenchServer[] = [];
	get local(): readonly McpWorkbenchServer[] { return this._local; }

	private readonly _onChange = this._register(new Emitter<IWorkbenchMcpServer | undefined>());
	readonly onChange = this._onChange.event;

	constructor(
		@IMcpGalleryService private readonly mcpGalleryService: IMcpGalleryService,
		@IMcpManagementService private readonly mcpManagementService: IMcpManagementService,
		@IEditorService private readonly editorService: IEditorService,
		@IInstantiationService private readonly instantiationService: IInstantiationService,
	) {
		super();
		this._register(this.mcpManagementService.onDidInstallMcpServers(e => this.onDidInstallMcpServers(e)));
		this._register(this.mcpManagementService.onDidUninstallMcpServer(e => this.onDidUninstallMcpServer(e)));
		this.queryLocal().then(async () => {
			await this.queryGallery();
			this._onChange.fire(undefined);
		});
	}

	private onDidUninstallMcpServer(e: DidUninstallMcpServerEvent) {
		if (e.error) {
			return;
		}
		const server = this._local.find(server => server.local?.name === e.name);
		if (server) {
			this._local = this._local.filter(server => server.local?.name !== e.name);
			server.local = undefined;
			this._onChange.fire(server);
		}
	}

	private onDidInstallMcpServers(e: readonly InstallMcpServerResult[]) {
		for (const result of e) {
			if (!result.local) {
				continue;
			}
			let server = this._local.find(server => server.local?.name === result.name);
			if (server) {
				server.local = result.local;
			} else {
				server = new McpWorkbenchServer(result.local, result.source);
				this._local.push(server);
			}
			this._onChange.fire(server);
		}
	}

	private fromGallery(gallery: IGalleryMcpServer): IWorkbenchMcpServer | undefined {
		for (const local of this._local) {
			if (local.id === gallery.id) {
				local.gallery = gallery;
				return local;
			}
		}
		return undefined;
	}

	async queryGallery(options?: IQueryOptions, token?: CancellationToken): Promise<IWorkbenchMcpServer[]> {
		const result = await this.mcpGalleryService.query(options, token);
		return result.map(gallery => this.fromGallery(gallery) ?? new McpWorkbenchServer(undefined, gallery));
	}

	async queryLocal(): Promise<IWorkbenchMcpServer[]> {
		const local = await this.mcpManagementService.getInstalled();
		this._local = local.map(local => new McpWorkbenchServer(local, undefined));
		return this._local;
	}

	async install(server: IWorkbenchMcpServer): Promise<void> {
		if (!server.gallery) {
			throw new Error('Gallery server is missing');
		}
		await this.mcpManagementService.installFromGallery(server.gallery, server.gallery.packageTypes[0]);
	}

	async uninstall(server: IWorkbenchMcpServer): Promise<void> {
		if (!server.local) {
			throw new Error('Local server is missing');
		}
		await this.mcpManagementService.uninstall(server.local);
	}

	async open(extension: IWorkbenchMcpServer, options?: IEditorOptions): Promise<void> {
		await this.editorService.openEditor(this.instantiationService.createInstance(McpServerEditorInput, extension), options, ACTIVE_GROUP);
	}

}


export class MCPContextsInitialisation extends Disposable implements IWorkbenchContribution {

	static ID = 'workbench.mcp.contexts.initialisation';

	constructor(
		@IMcpWorkbenchService mcpWorkbenchService: IMcpWorkbenchService,
		@IContextKeyService contextKeyService: IContextKeyService,
	) {
		super();
		const hasInstalledMcpServersContextKey = HasInstalledMcpServersContext.bindTo(contextKeyService);
		this._register(mcpWorkbenchService.onChange(() => hasInstalledMcpServersContextKey.set(mcpWorkbenchService.local.length > 0)));
	}
}
