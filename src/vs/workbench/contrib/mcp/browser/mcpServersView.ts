/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import './media/mcpServers.css';
import * as dom from '../../../../base/browser/dom.js';
import { ActionBar } from '../../../../base/browser/ui/actionbar/actionbar.js';
import { IListRenderer } from '../../../../base/browser/ui/list/list.js';
import { Event } from '../../../../base/common/event.js';
import { combinedDisposable, dispose, IDisposable } from '../../../../base/common/lifecycle.js';
import { DelayedPagedModel, IPagedModel, PagedModel } from '../../../../base/common/paging.js';
import { localize } from '../../../../nls.js';
import { IConfigurationService } from '../../../../platform/configuration/common/configuration.js';
import { IContextKeyService } from '../../../../platform/contextkey/common/contextkey.js';
import { IContextMenuService } from '../../../../platform/contextview/browser/contextView.js';
import { IHoverService } from '../../../../platform/hover/browser/hover.js';
import { IInstantiationService } from '../../../../platform/instantiation/common/instantiation.js';
import { IKeybindingService } from '../../../../platform/keybinding/common/keybinding.js';
import { WorkbenchPagedList } from '../../../../platform/list/browser/listService.js';
import { INotificationService } from '../../../../platform/notification/common/notification.js';
import { IOpenerService } from '../../../../platform/opener/common/opener.js';
import { IThemeService } from '../../../../platform/theme/common/themeService.js';
import { getLocationBasedViewColors, ViewPane } from '../../../browser/parts/views/viewPane.js';
import { IViewletViewOptions } from '../../../browser/parts/views/viewsViewlet.js';
import { IViewDescriptorService } from '../../../common/views.js';
import { DefaultIconPath } from '../../../services/extensionManagement/common/extensionManagement.js';
import { IMcpWorkbenchService, IWorkbenchMcpServer, McpServerContainers } from '../common/mcpTypes.js';
import { InstallAction, UninstallAction } from './mcpServerActions.js';
import { PublisherWidget, InstallCountWidget, RatingsWidget } from './mcpServerWidgets.js';

export class McpServersListView extends ViewPane {

	private list: WorkbenchPagedList<IWorkbenchMcpServer> | null = null;

	constructor(
		options: IViewletViewOptions,
		@IKeybindingService keybindingService: IKeybindingService,
		@IContextMenuService contextMenuService: IContextMenuService,
		@IInstantiationService instantiationService: IInstantiationService,
		@IThemeService themeService: IThemeService,
		@IHoverService hoverService: IHoverService,
		@IConfigurationService configurationService: IConfigurationService,
		@IContextKeyService contextKeyService: IContextKeyService,
		@IViewDescriptorService viewDescriptorService: IViewDescriptorService,
		@IOpenerService openerService: IOpenerService,
		@IMcpWorkbenchService private readonly mcpWorkbenchService: IMcpWorkbenchService,
	) {
		super(options, keybindingService, contextMenuService, configurationService, contextKeyService, viewDescriptorService, instantiationService, openerService, themeService, hoverService);
	}

	protected override renderBody(container: HTMLElement): void {
		super.renderBody(container);

		const mcpServersList = dom.append(container, dom.$('.mcp-servers-list'));
		this.list = this._register(this.instantiationService.createInstance(WorkbenchPagedList,
			`${this.id}-MCP-Servers`,
			mcpServersList,
			{
				getHeight() { return 72; },
				getTemplateId: () => McpServerRenderer.templateId,
			},
			[this.instantiationService.createInstance(McpServerRenderer)],
			{
				multipleSelectionSupport: false,
				setRowLineHeight: false,
				horizontalScrolling: false,
				accessibilityProvider: {
					getAriaLabel(mcpServer: IWorkbenchMcpServer | null): string {
						return mcpServer?.label ?? '';
					},
					getWidgetAriaLabel(): string {
						return localize('mcp servers', "MCP Servers");
					}
				},
				overrideStyles: getLocationBasedViewColors(this.viewDescriptorService.getViewLocationById(this.id)).listOverrideStyles,
				openOnSingleClick: true,
			}) as WorkbenchPagedList<IWorkbenchMcpServer>);
		this._register(Event.debounce(Event.filter(this.list.onDidOpen, e => e.element !== null), (_, event) => event, 75, true)(options => {
			this.mcpWorkbenchService.open(options.element!, options.editorOptions);
		}));
	}

	protected override layoutBody(height: number, width: number): void {
		super.layoutBody(height, width);
		this.list?.layout(height, width);
	}

	async show(query: string): Promise<IPagedModel<IWorkbenchMcpServer>> {
		if (!this.list) {
			return new PagedModel([]);
		}

		query = query.trim();
		const servers = query ? await this.mcpWorkbenchService.queryGallery({ text: query.replace('@mcp', '') }) : await this.mcpWorkbenchService.queryLocal();
		this.list.model = new DelayedPagedModel(new PagedModel(servers));
		return this.list.model;
	}

}

interface IMcpServerTemplateData {
	root: HTMLElement;
	element: HTMLElement;
	icon: HTMLImageElement;
	name: HTMLElement;
	description: HTMLElement;
	installCount: HTMLElement;
	ratings: HTMLElement;
	mcpServer: IWorkbenchMcpServer | null;
	disposables: IDisposable[];
	mcpServerDisposables: IDisposable[];
	actionbar: ActionBar;
}

class McpServerRenderer implements IListRenderer<IWorkbenchMcpServer, IMcpServerTemplateData> {

	static readonly templateId = 'mcpServer';
	readonly templateId = McpServerRenderer.templateId;

	constructor(
		@IInstantiationService private readonly instantiationService: IInstantiationService,
		@INotificationService private readonly notificationService: INotificationService,
	) { }

	renderTemplate(root: HTMLElement): IMcpServerTemplateData {
		const element = dom.append(root, dom.$('.mcp-server-item'));
		const iconContainer = dom.append(element, dom.$('.icon-container'));
		const icon = dom.append(iconContainer, dom.$<HTMLImageElement>('img.icon', { alt: '' }));
		const details = dom.append(element, dom.$('.details-container'));
		const nameContainer = dom.append(details, dom.$('.name-container'));
		const name = dom.append(nameContainer, dom.$('span.name'));
		const description = dom.append(details, dom.$('.description.ellipsis'));
		const footerContainer = dom.append(details, dom.$('.footer-container'));
		const publisherWidget = this.instantiationService.createInstance(PublisherWidget, dom.append(footerContainer, dom.$('.publisher-container')), true);
		const statsContainer = dom.append(footerContainer, dom.$('.stats-container'));
		const installCount = dom.append(statsContainer, dom.$('span.install-count'));
		const ratings = dom.append(statsContainer, dom.$('span.ratings'));
		const actionbar = new ActionBar(dom.append(footerContainer, dom.$('.actions-container.mcp-server-actions')));

		actionbar.setFocusable(false);
		const actionBarListener = actionbar.onDidRun(({ error }) => error && this.notificationService.error(error));

		const actions = [
			this.instantiationService.createInstance(InstallAction),
			this.instantiationService.createInstance(UninstallAction),
		];

		const widgets = [
			publisherWidget,
			this.instantiationService.createInstance(InstallCountWidget, installCount, true),
			this.instantiationService.createInstance(RatingsWidget, ratings, true),
		];
		const extensionContainers: McpServerContainers = this.instantiationService.createInstance(McpServerContainers, [...actions, ...widgets]);

		actionbar.push(actions, { icon: true, label: true });
		const disposable = combinedDisposable(...actions, ...widgets, actionbar, actionBarListener, extensionContainers);

		return {
			root, element, icon, name, description, installCount, ratings, disposables: [disposable], actionbar,
			mcpServerDisposables: [],
			set mcpServer(mcpServer: IWorkbenchMcpServer) {
				extensionContainers.mcpServer = mcpServer;
			}
		};
	}

	renderElement(mcpServer: IWorkbenchMcpServer, index: number, data: IMcpServerTemplateData): void {
		data.element.classList.remove('loading');
		data.element.classList.remove('hidden');
		data.mcpServerDisposables = dispose(data.mcpServerDisposables);

		if (!mcpServer) {
			data.element.classList.add('hidden');
			data.mcpServer = null;
			return;
		}

		data.root.setAttribute('data-mcp-server-id', mcpServer.id);
		data.mcpServerDisposables.push(dom.addDisposableListener(data.icon, 'error', () => data.icon.src = DefaultIconPath, { once: true }));
		data.icon.src = mcpServer.iconUrl;

		if (!data.icon.complete) {
			data.icon.style.visibility = 'hidden';
			data.icon.onload = () => data.icon.style.visibility = 'inherit';
		} else {
			data.icon.style.visibility = 'inherit';
		}

		data.name.textContent = mcpServer.label;
		data.description.textContent = mcpServer.description;

		data.installCount.style.display = '';
		data.ratings.style.display = '';
		data.mcpServer = mcpServer;
	}

	disposeElement(mcpServer: IWorkbenchMcpServer, index: number, data: IMcpServerTemplateData): void {
		data.mcpServerDisposables = dispose(data.mcpServerDisposables);
	}

	disposeTemplate(data: IMcpServerTemplateData): void {
		data.mcpServerDisposables = dispose(data.mcpServerDisposables);
		data.disposables = dispose(data.disposables);
	}
}
