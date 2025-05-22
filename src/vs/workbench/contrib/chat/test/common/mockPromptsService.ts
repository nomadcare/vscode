/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { URI } from '../../../../../base/common/uri.js';
import { ITextModel } from '../../../../../editor/common/model.js';
import { TextModelPromptParser } from '../../common/promptSyntax/parsers/textModelPromptParser.js';
import { IChatPromptSlashCommand, IMetadata, IPromptPath, IPromptsService, TPromptsType } from '../../common/promptSyntax/service/types.js';

export class MockPromptsService implements IPromptsService {
	_serviceBrand: undefined;

	getAllMetadata(_files: readonly URI[]): Promise<readonly IMetadata[]> {
		throw new Error('Method not implemented.');
	}
	getMetadata(_file: URI): Promise<IMetadata> {
		throw new Error('Method not implemented.');
	}
	getSyntaxParserFor(_model: ITextModel): TextModelPromptParser & { isDisposed: false } {
		throw new Error('Method not implemented.');
	}
	listPromptFiles(_type: TPromptsType): Promise<readonly IPromptPath[]> {
		throw new Error('Method not implemented.');
	}
	getSourceFolders(_type: TPromptsType): readonly IPromptPath[] {
		throw new Error('Method not implemented.');
	}
	public asPromptSlashCommand(command: string): IChatPromptSlashCommand | undefined {
		return undefined;
	}
	resolvePromptSlashCommand(_data: IChatPromptSlashCommand): Promise<IMetadata | undefined> {
		throw new Error('Method not implemented.');
	}
	findPromptSlashCommands(): Promise<IChatPromptSlashCommand[]> {
		throw new Error('Method not implemented.');
	}
	findInstructionFilesFor(_files: readonly URI[]): Promise<readonly URI[]> {
		throw new Error('Method not implemented.');
	}
	dispose(): void { }
}
