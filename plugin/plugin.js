(function(window, undefined) {

	// Cache UI selectors
	const tabPrompt = document.getElementById('tab-prompt');
	const tabStructure = document.getElementById('tab-structure');
	const tabConsole = document.getElementById('tab-console');
	const tabSettings = document.getElementById('tab-settings');
	
	const viewPrompt = document.getElementById('view-prompt');
	const viewStructure = document.getElementById('view-structure');
	const viewConsole = document.getElementById('view-console');
	const viewSettings = document.getElementById('view-settings');
	
	const structureJson = document.getElementById('structure-json');
	const copyStructure = document.getElementById('copy-structure');
	const refreshStructure = document.getElementById('refresh-structure');

	const apiKeyInput = document.getElementById('api-key');
	const toggleKeyVisibility = document.getElementById('toggle-key-visibility');
	const saveKeyBtn = document.getElementById('save-key-btn');
	const removeKeyBtn = document.getElementById('remove-key-btn');

	const modelSelect = document.getElementById('model-select');
	const modelCostBadge = document.getElementById('model-cost-badge');
	const promptInput = document.getElementById('prompt-input');
	const executeBtn = document.getElementById('execute-btn');
	const logContainer = document.getElementById('log-container');
	const clearLogsBtn = document.getElementById('clear-logs');
	const resetLogsBtn = document.getElementById('reset-logs');
	
	const chatHistoryContainer = document.getElementById('chat-history');
	const undoAiBtn = document.getElementById('undo-ai-btn');
	const contextToolbar = document.getElementById('context-toolbar');
	let appliedChangesCount = 0;
	let currentChatProposal = null;

	// Undo / Redo selectors
	const toolbarUndo = document.getElementById('toolbar-undo');
	const toolbarRedo = document.getElementById('toolbar-redo');

	// Persistent Log File
	const logStorageKey = "onescript_log_file";
	let logLines = [];

	// Summarization elements
	const chipSummarize = document.getElementById('chip-summarize');
	let activeSummaryContent = '';

	// Session Checkpoints elements
	const saveCheckpointBtn = document.getElementById('save-checkpoint-btn');
	const checkpointsList = document.getElementById('checkpoints-list');

	// New Redesigned UI Selectors
	const toggleViewOutline = document.getElementById('toggle-view-outline');
	const toggleViewJson = document.getElementById('toggle-view-json');
	const outlineTreeContainer = document.getElementById('outline-tree-container');

	const btnTabLogs = document.getElementById('btn-tab-logs');
	const btnTabTelemetry = document.getElementById('btn-tab-telemetry');
	const paneLogs = document.getElementById('pane-logs');
	const paneTelemetry = document.getElementById('pane-telemetry');

	const slashMenu = document.getElementById('slash-menu');
	const promptScopeBadge = document.getElementById('prompt-scope-badge');

	let activeAiMessageBody = null;
	let currentAgentSteps = null;

	let cachedDocData = null;
	let proposedChanges = null;
	let checkpoints = [];

	// Chat rendering helper
	function appendChatMessage(sender, content, type = 'text') {
		const welcome = chatHistoryContainer.querySelector('.chat-welcome');
		if (welcome) {
			welcome.style.display = 'none';
		}

		const messageDiv = document.createElement('div');
		messageDiv.className = `chat-message ${sender}`;
		
		const header = document.createElement('div');
		header.className = 'message-header';
		header.innerText = sender === 'user' ? 'You' : 'OneScript';
		
		const body = document.createElement('div');
		body.className = 'message-body';
		
		if (type === 'html') {
			body.innerHTML = content;
		} else {
			body.textContent = content;
		}
		
		messageDiv.appendChild(header);
		messageDiv.appendChild(body);
		chatHistoryContainer.appendChild(messageDiv);
		
		chatHistoryContainer.scrollTop = chatHistoryContainer.scrollHeight;
		return messageDiv;
	}

	// Helper to perform multiple undo operations sequentially
	function performMultipleUndos(n, callback) {
		if (n <= 0) {
			if (callback) callback();
			return;
		}
		window.Asc.plugin.executeMethod("Undo", [], () => {
			performMultipleUndos(n - 1, callback);
		});
	}

	// Render Proposed Changes Inline
	function renderChatPreview(aiMessageBody, changes, applied = false) {
		aiMessageBody.innerHTML = '';
		
		const wrapper = document.createElement('div');
		wrapper.style.display = 'flex';
		wrapper.style.flexDirection = 'column';
		wrapper.style.gap = '8px';
		wrapper.style.marginTop = '6px';
		
		const title = document.createElement('div');
		title.style.fontWeight = 'bold';
		title.style.color = 'var(--primary)';
		title.style.fontSize = '11px';
		title.innerText = applied ? 'Applied Changes Summary:' : 'Proposed Changes Preview:';
		wrapper.appendChild(title);
		
		const changesListDiv = document.createElement('div');
		changesListDiv.style.maxHeight = '140px';
		changesListDiv.style.overflowY = 'auto';
		changesListDiv.style.display = 'flex';
		changesListDiv.style.flexDirection = 'column';
		changesListDiv.style.gap = '6px';
		
		changes.forEach((change) => {
			const original = findElementByIndex(change.targetIndex);
			if (!original && change.action !== 'createParagraph') return;
			
			const item = document.createElement('div');
			item.style.padding = '6px';
			item.style.background = 'var(--bg-base)';
			item.style.border = '1px solid var(--border-color)';
			item.style.borderRadius = '2px';
			item.style.fontSize = '10px';
			
			let actionBadge = '';
			if (change.action === 'createParagraph') {
				actionBadge = '<span class="badge-action action-create" style="font-size: 8px;">Create</span>';
			} else if (change.action === 'deleteParagraph') {
				actionBadge = '<span class="badge-action action-delete" style="font-size: 8px;">Delete</span>';
			} else if (change.action === 'pasteHTML') {
				actionBadge = '<span class="badge-action action-generate" style="font-size: 8px; background: rgba(139, 92, 246, 0.15); color: #a78bfa; border: 1px solid rgba(139, 92, 246, 0.3);">Generate</span>';
			} else {
				actionBadge = '<span class="badge-action action-modify" style="font-size: 8px;">Modify</span>';
			}
			
			let formatStr = '';
			const props = change.properties || {};
			if (props.fontName) formatStr += `Font: ${props.fontName}; `;
			if (props.fontSize) formatStr += `Size: ${props.fontSize/2}pt; `;
			if (props.bold !== undefined) formatStr += props.bold ? 'Bold; ' : 'Regular; ';
			if (props.italic !== undefined) formatStr += props.italic ? 'Italic; ' : 'No Italic; ';
			if (props.alignment !== undefined) formatStr += `Align: ${props.alignment}; `;
			
			const originalText = original ? (original.text || `[Table Element at #${change.targetIndex}]`) : '';
			
			let diffHTML = '';
			if (change.action === 'deleteParagraph') {
				diffHTML = `<div class="diff-original" style="font-size: 9.5px; color: var(--error); text-decoration: line-through;">- "${originalText.substring(0, 50)}${originalText.length > 50 ? '...' : ''}"</div>`;
			} else if (change.action === 'createParagraph') {
				diffHTML = `<div class="diff-new" style="font-size: 9.5px; color: var(--success);">+ "${(props.newText || '').substring(0, 50)}"</div>`;
			} else if (change.action === 'pasteHTML') {
				diffHTML = `<div class="diff-new" style="font-size: 9.5px; color: #8b5cf6;">✨ Generated Content</div>`;
			} else {
				if (props.newText !== undefined && props.newText !== originalText) {
					diffHTML = `
						<div class="diff-original" style="font-size: 9.5px; color: var(--error); text-decoration: line-through;">- "${originalText.substring(0, 40)}"</div>
						<div class="diff-new" style="font-size: 9.5px; color: var(--success);">+ "${props.newText.substring(0, 40)}"</div>
					`;
				} else if (originalText) {
					diffHTML = `<div style="font-size: 9.5px; color: var(--text-secondary); font-style: italic;">"${originalText.substring(0, 50)}..."</div>`;
				}
			}
			
			item.innerHTML = `
				<div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 4px;">
					<span style="font-weight: bold;">Element #${change.targetIndex + 1}</span>
					${actionBadge}
				</div>
				${diffHTML}
				${formatStr ? `<div style="font-size: 9px; color: var(--primary); margin-top: 2px;">Styles: ${formatStr}</div>` : ''}
			`;
			changesListDiv.appendChild(item);
		});
		
		wrapper.appendChild(changesListDiv);
		
		const btnGroup = document.createElement('div');
		btnGroup.style.display = 'flex';
		btnGroup.style.gap = '6px';
		btnGroup.style.marginTop = '6px';
		
		const acceptBtn = document.createElement('button');
		acceptBtn.className = 'btn';
		acceptBtn.innerText = applied ? 'Accept (Keep)' : 'Accept & Apply';
		acceptBtn.style.flex = '1.2';
		acceptBtn.style.fontSize = '10px';
		acceptBtn.style.padding = '6px';
		acceptBtn.style.background = 'var(--success)';
		
		const discardBtn = document.createElement('button');
		discardBtn.className = 'btn btn-outline btn-danger';
		discardBtn.innerText = applied ? 'Discard (Undo)' : 'Discard';
		discardBtn.style.flex = '0.8';
		discardBtn.style.fontSize = '10px';
		discardBtn.style.padding = '6px';
		
		btnGroup.appendChild(acceptBtn);
		btnGroup.appendChild(discardBtn);
		wrapper.appendChild(btnGroup);
		
		aiMessageBody.appendChild(wrapper);
		
		return new Promise((resolve) => {
			acceptBtn.addEventListener('click', () => {
				acceptBtn.disabled = true;
				discardBtn.disabled = true;
				if (applied) {
					btnGroup.remove();
					const msg = document.createElement('div');
					msg.style.color = 'var(--success)';
					msg.style.fontWeight = '600';
					msg.style.fontSize = '10.5px';
					msg.style.marginTop = '4px';
					msg.innerText = '✓ Changes accepted.';
					wrapper.appendChild(msg);
					appliedChangesCount = 0;
					undoAiBtn.style.display = 'none';
					log('User accepted the AI document modifications.', 'success');
				} else {
					acceptBtn.innerText = 'Applying...';
				}
				resolve('accept');
			});
			
			discardBtn.addEventListener('click', () => {
				acceptBtn.disabled = true;
				discardBtn.disabled = true;
				if (applied) {
					btnGroup.remove();
					const msg = document.createElement('div');
					msg.style.color = 'var(--error)';
					msg.style.fontWeight = '600';
					msg.style.fontSize = '10.5px';
					msg.style.marginTop = '4px';
					msg.innerText = '✗ Reverting changes...';
					wrapper.appendChild(msg);
					
					log(`User discarded the AI modifications. Undoing ${appliedChangesCount} operations...`, 'warning');
					performMultipleUndos(appliedChangesCount, () => {
						log('Reversal complete. Document successfully restored.', 'success');
						msg.innerText = '✗ Changes discarded & reverted.';
						appliedChangesCount = 0;
						undoAiBtn.style.display = 'none';
						debouncedRefresh();
					});
				} else {
					wrapper.innerHTML = '<div style="color: var(--text-muted); font-style: italic; margin-top: 4px;">Proposed changes discarded.</div>';
				}
				resolve('discard');
			});
		});
	}

	// Render Executive Summary Inline
	function renderSummaryInMessage(aiMessageBody, summaryContent) {
		aiMessageBody.innerHTML = '';
		
		const wrapper = document.createElement('div');
		wrapper.style.display = 'flex';
		wrapper.style.flexDirection = 'column';
		wrapper.style.gap = '8px';
		wrapper.style.marginTop = '6px';
		
		const title = document.createElement('div');
		title.style.fontWeight = 'bold';
		title.style.color = 'var(--primary)';
		title.style.fontSize = '11px';
		title.innerText = 'AI Executive Summary:';
		wrapper.appendChild(title);
		
		const textDiv = document.createElement('div');
		textDiv.style.fontSize = '11px';
		textDiv.style.lineHeight = '1.5';
		textDiv.innerText = summaryContent;
		wrapper.appendChild(textDiv);
		
		const insertBtn = document.createElement('button');
		insertBtn.className = 'btn';
		insertBtn.innerText = 'Insert Summary at Cursor';
		insertBtn.style.fontSize = '10px';
		insertBtn.style.padding = '6px';
		insertBtn.style.background = 'var(--info)';
		
		wrapper.appendChild(insertBtn);
		aiMessageBody.appendChild(wrapper);
		
		insertBtn.addEventListener('click', () => {
			insertBtn.disabled = true;
			insertBtn.innerText = 'Inserting...';
			
			window.Asc.scope.summaryText = "\n\n" + summaryContent + "\n\n";
			window.Asc.plugin.callCommand(function() {
				var oDocument = Api.GetDocument();
				var oParagraph = Api.CreateParagraph();
				oParagraph.AddText(Asc.scope.summaryText);
				oDocument.InsertContent([oParagraph]);
				return "success";
			}, false, true, function(res) {
				insertBtn.innerText = 'Inserted ✓';
				log("Summary successfully inserted into document!", "success");
			});
		});
	}

	// Detect selection type and active properties
	function detectSelectionType() {
		return new Promise((resolve) => {
			window.Asc.plugin.callCommand(function() {
				var result = { type: "text", properties: {} };
				try {
					var oDocument = Api.GetDocument();
					var oRange = oDocument.GetRangeBySelect();
					if (oRange) {
						var pList = oRange.GetAllParagraphs();
						if (pList && pList.length > 0) {
							if (pList[0].GetParentTable() !== null) {
								result.type = "table";
								return result;
							}
						}
						
						// Extract text formatting properties
						var fontName = "Calibri";
						var fontSize = 11;
						var bold = false;
						var italic = false;
						var underline = false;
						var strikeout = false;
						var color = "#000000";
						var shading = "#ffffff";
						
						if (pList && pList.length > 0) {
							var p = pList[0];
							var runCount = p.GetElementsCount();
							if (runCount > 0) {
								var firstRun = p.GetElement(0);
								if (firstRun) {
									try { fontName = firstRun.GetFontName() || fontName; } catch(e) {}
									try { fontSize = (firstRun.GetFontSize() || 22) / 2; } catch(e) {}
									try { bold = !!firstRun.GetBold(); } catch(e) {}
									try { italic = !!firstRun.GetItalic(); } catch(e) {}
									try { underline = !!firstRun.GetUnderline(); } catch(e) {}
									try { strikeout = !!firstRun.GetStrikeout(); } catch(e) {}
									try {
										var c = firstRun.GetColor();
										if (c && c.GetHex) color = c.GetHex() || color;
									} catch(e) {}
								}
							}
							try {
								var pPr = p.GetParaPr();
								if (pPr && pPr.GetShd) {
									var sd = pPr.GetShd();
									if (sd) {
										if (typeof sd === "string") shading = sd;
										else if (sd.GetHex) shading = sd.GetHex() || shading;
									}
								}
							} catch(e) {}
						}
						result.properties = {
							fontName: fontName,
							fontSize: fontSize,
							bold: bold,
							italic: italic,
							underline: underline,
							strikeout: strikeout,
							color: color,
							shading: shading
						};
					}
				} catch(e) {}
				
				if (result.type === "text") {
					try {
						var oSelection = Api.GetSelection();
						if (oSelection) {
							var classType = oSelection.GetClassType();
							if (classType === "image" || classType === "ApiImage") {
								result.type = "image";
							} else if (classType === "shape" || classType === "ApiShape") {
								result.type = "shape";
								try {
									var fill = oSelection.GetFill();
									if (fill && fill.GetColor) result.properties.fill = fill.GetColor().GetHex();
									var outline = oSelection.GetOutline();
									if (outline && outline.GetColor) result.properties.outline = outline.GetColor().GetHex();
								} catch(e) {}
							} else if (classType === "chart" || classType === "ApiChart") {
								result.type = "chart";
							} else if (classType === "drawing" || classType === "ApiDrawing") {
								result.type = "shape";
							}
						}
					} catch(e) {}
				}
				return result;
			}, false, true, function(result) {
				if (!result || result.type === "none") {
					window.Asc.plugin.executeMethod("GetSelectionType", [], function(type) {
						if (type === "drawing") {
							resolve({ type: "image", properties: {} });
						} else {
							resolve({ type: "text", properties: {} });
						}
					});
				} else {
					resolve(result);
				}
			});
		});
	}

	// Render Contextual ONLYOFFICE Toolbar
	function renderContextToolbar(type, props = {}) {
		if (!contextToolbar) return;
		if (type === "none" || !type) {
			contextToolbar.style.display = "none";
			return;
		}
		contextToolbar.style.display = "block";
		
		let html = "";
		if (type === "text") {
			html = `
				<div style="display: flex; flex-direction: column; gap: 6px;">
					<div style="display: flex; gap: 4px; align-items: center; justify-content: space-between;">
						<span style="font-weight: bold; font-size: 9px; text-transform: uppercase; color: var(--text-secondary);">Text Formatting</span>
						<span class="badge" style="font-size: 8px;">Text</span>
					</div>
					<div style="display: flex; flex-wrap: wrap; gap: 4px; align-items: center;">
						<button class="tool-icon-btn ${props.bold ? 'active' : ''}" id="toolbar-bold" title="Bold" style="font-weight: bold;">B</button>
						<button class="tool-icon-btn ${props.italic ? 'active' : ''}" id="toolbar-italic" title="Italic" style="font-style: italic;">I</button>
						<button class="tool-icon-btn ${props.underline ? 'active' : ''}" id="toolbar-underline" title="Underline" style="text-decoration: underline;">U</button>
						<button class="tool-icon-btn ${props.strikeout ? 'active' : ''}" id="toolbar-strikeout" title="Strikeout" style="text-decoration: line-through;">S</button>
						
						<div style="width: 1px; height: 16px; background: var(--border-color); margin: 0 2px;"></div>
						
						<button class="tool-icon-btn" id="toolbar-align-left" title="Align Left">L</button>
						<button class="tool-icon-btn" id="toolbar-align-center" title="Align Center">C</button>
						<button class="tool-icon-btn" id="toolbar-align-right" title="Align Right">R</button>
						<button class="tool-icon-btn" id="toolbar-align-justify" title="Justify">J</button>
					</div>
					<div style="display: flex; gap: 4px; align-items: center;">
						<select id="toolbar-font-family" style="flex: 1.5; height: 22px; padding: 2px 4px; font-size: 10px;">
							<option value="Calibri" ${props.fontName === 'Calibri' ? 'selected' : ''}>Calibri</option>
							<option value="Arial" ${props.fontName === 'Arial' ? 'selected' : ''}>Arial</option>
							<option value="Times New Roman" ${props.fontName === 'Times New Roman' ? 'selected' : ''}>Times New Roman</option>
							<option value="Georgia" ${props.fontName === 'Georgia' ? 'selected' : ''}>Georgia</option>
							<option value="Courier New" ${props.fontName === 'Courier New' ? 'selected' : ''}>Courier New</option>
						</select>
						
						<select id="toolbar-font-size" style="flex: 1; height: 22px; padding: 2px 4px; font-size: 10px;">
							${[8, 9, 10, 11, 12, 14, 16, 18, 20, 24, 28, 36, 48].map(s => `
								<option value="${s}" ${Math.round(props.fontSize) === s ? 'selected' : ''}>${s}pt</option>
							`).join('')}
						</select>
						
						<input type="color" id="toolbar-font-color" value="${props.color || '#000000'}" title="Text Color" style="width: 22px; height: 22px; padding: 0; border: 1px solid var(--border-color); cursor: pointer; background: none;">
						<input type="color" id="toolbar-shading-color" value="${props.shading || '#ffffff'}" title="Background Color" style="width: 22px; height: 22px; padding: 0; border: 1px solid var(--border-color); cursor: pointer; background: none;">
					</div>
				</div>
			`;
		} else if (type === "table") {
			html = `
				<div style="display: flex; flex-direction: column; gap: 6px;">
					<div style="display: flex; gap: 4px; align-items: center; justify-content: space-between;">
						<span style="font-weight: bold; font-size: 9px; text-transform: uppercase; color: var(--text-secondary);">Table Tools</span>
						<span class="badge" style="font-size: 8px; color: var(--accent-purple); border-color: var(--accent-purple);">Table</span>
					</div>
					<div style="display: flex; flex-wrap: wrap; gap: 4px; align-items: center;">
						<button class="btn btn-outline" id="toolbar-table-row-above" style="font-size: 9px; padding: 4px; flex: 1; height: 22px;">+ Row Above</button>
						<button class="btn btn-outline" id="toolbar-table-row-below" style="font-size: 9px; padding: 4px; flex: 1; height: 22px;">+ Row Below</button>
					</div>
					<div style="display: flex; flex-wrap: wrap; gap: 4px; align-items: center;">
						<button class="btn btn-outline" id="toolbar-table-col-left" style="font-size: 9px; padding: 4px; flex: 1; height: 22px;">+ Col Left</button>
						<button class="btn btn-outline" id="toolbar-table-col-right" style="font-size: 9px; padding: 4px; flex: 1; height: 22px;">+ Col Right</button>
					</div>
					<div style="display: flex; gap: 4px; align-items: center;">
						<button class="btn btn-danger" id="toolbar-table-delete-row" style="font-size: 9px; padding: 4px; flex: 1; height: 22px;">Del Row</button>
						<button class="btn btn-danger" id="toolbar-table-delete-col" style="font-size: 9px; padding: 4px; flex: 1; height: 22px;">Del Col</button>
						<div style="display: flex; align-items: center; gap: 4px; flex: 1; justify-content: flex-end;">
							<span style="font-size: 9px; color: var(--text-secondary);">Bg:</span>
							<input type="color" id="toolbar-table-shading" value="#ffffff" title="Cell Shading" style="width: 22px; height: 22px; padding: 0; border: 1px solid var(--border-color); cursor: pointer; background: none;">
						</div>
					</div>
				</div>
			`;
		} else if (type === "image") {
			html = `
				<div style="display: flex; flex-direction: column; gap: 6px;">
					<div style="display: flex; gap: 4px; align-items: center; justify-content: space-between;">
						<span style="font-weight: bold; font-size: 9px; text-transform: uppercase; color: var(--text-secondary);">Image Settings</span>
						<span class="badge" style="font-size: 8px; color: var(--success); border-color: var(--success);">Image</span>
					</div>
					<div style="display: flex; gap: 4px; align-items: center;">
						<div style="display: flex; align-items: center; gap: 2px; flex: 1;">
							<span style="font-size: 9px; color: var(--text-secondary);">W (mm):</span>
							<input type="text" id="toolbar-img-width" value="${props.width || '100'}" style="height: 20px; width: 36px; font-size: 9px; padding: 2px; text-align: center; border: 1px solid var(--border-color); background: var(--bg-input); color: var(--text-primary);">
						</div>
						<div style="display: flex; align-items: center; gap: 2px; flex: 1;">
							<span style="font-size: 9px; color: var(--text-secondary);">H (mm):</span>
							<input type="text" id="toolbar-img-height" value="${props.height || '80'}" style="height: 20px; width: 36px; font-size: 9px; padding: 2px; text-align: center; border: 1px solid var(--border-color); background: var(--bg-input); color: var(--text-primary);">
						</div>
						<button class="btn" id="toolbar-img-apply-size" style="font-size: 9px; padding: 2px 6px; height: 20px; width: auto;">Set</button>
					</div>
					<div style="display: flex; gap: 4px; align-items: center;">
						<button class="btn btn-outline" id="toolbar-img-rotate" style="font-size: 9px; padding: 4px; flex: 1; height: 22px;">Rotate 90°</button>
					</div>
				</div>
			`;
		} else if (type === "shape") {
			html = `
				<div style="display: flex; flex-direction: column; gap: 6px;">
					<div style="display: flex; gap: 4px; align-items: center; justify-content: space-between;">
						<span style="font-weight: bold; font-size: 9px; text-transform: uppercase; color: var(--text-secondary);">Shape Format</span>
						<span class="badge" style="font-size: 8px; color: var(--info); border-color: var(--info);">Shape</span>
					</div>
					<div style="display: flex; gap: 4px; align-items: center; justify-content: space-between;">
						<div style="display: flex; align-items: center; gap: 4px;">
							<span style="font-size: 9px; color: var(--text-secondary);">Fill:</span>
							<input type="color" id="toolbar-shape-fill" value="${props.fill || '#3498db'}" title="Fill Color" style="width: 20px; height: 20px; padding: 0; border: 1px solid var(--border-color); cursor: pointer; background: none;">
						</div>
						<div style="display: flex; align-items: center; gap: 4px;">
							<span style="font-size: 9px; color: var(--text-secondary);">Line:</span>
							<input type="color" id="toolbar-shape-outline" value="${props.outline || '#000000'}" title="Outline Color" style="width: 20px; height: 20px; padding: 0; border: 1px solid var(--border-color); cursor: pointer; background: none;">
						</div>
						<div style="display: flex; align-items: center; gap: 2px;">
							<span style="font-size: 9px; color: var(--text-secondary);">Wt:</span>
							<select id="toolbar-shape-weight" style="height: 20px; font-size: 9px; padding: 0 2px;">
								<option value="1" ${props.weight === 1 ? 'selected' : ''}>1pt</option>
								<option value="2" ${props.weight === 2 ? 'selected' : ''}>2pt</option>
								<option value="3" ${props.weight === 3 ? 'selected' : ''}>3pt</option>
								<option value="5" ${props.weight === 5 ? 'selected' : ''}>5pt</option>
							</select>
						</div>
					</div>
					<div style="display: flex; gap: 4px; align-items: center;">
						<div style="display: flex; align-items: center; gap: 2px; flex: 1;">
							<span style="font-size: 9px; color: var(--text-secondary);">W (mm):</span>
							<input type="text" id="toolbar-shape-width" value="${props.width || '50'}" style="height: 20px; width: 36px; font-size: 9px; padding: 2px; text-align: center; border: 1px solid var(--border-color); background: var(--bg-input); color: var(--text-primary);">
						</div>
						<div style="display: flex; align-items: center; gap: 2px; flex: 1;">
							<span style="font-size: 9px; color: var(--text-secondary);">H (mm):</span>
							<input type="text" id="toolbar-shape-height" value="${props.height || '50'}" style="height: 20px; width: 36px; font-size: 9px; padding: 2px; text-align: center; border: 1px solid var(--border-color); background: var(--bg-input); color: var(--text-primary);">
						</div>
						<button class="btn" id="toolbar-shape-apply" style="font-size: 9px; padding: 2px 6px; height: 20px; width: auto;">Set</button>
					</div>
				</div>
			`;
		} else if (type === "chart") {
			html = `
				<div style="display: flex; flex-direction: column; gap: 6px;">
					<div style="display: flex; gap: 4px; align-items: center; justify-content: space-between;">
						<span style="font-weight: bold; font-size: 9px; text-transform: uppercase; color: var(--text-secondary);">Chart Editor</span>
						<span class="badge" style="font-size: 8px; color: var(--primary); border-color: var(--primary);">Chart</span>
					</div>
					<div style="display: flex; gap: 4px; align-items: center;">
						<span style="font-size: 9px; color: var(--text-secondary); flex-shrink: 0;">Title:</span>
						<input type="text" id="toolbar-chart-title" value="${props.title || ''}" placeholder="Chart Title..." style="flex: 1; height: 22px; font-size: 10px; padding: 4px; border: 1px solid var(--border-color); background: var(--bg-input); color: var(--text-primary);">
						<button class="btn btn-outline" id="toolbar-chart-apply-title" style="font-size: 9px; padding: 2px 6px; height: 22px; width: auto;">Set</button>
					</div>
					<div style="display: flex; gap: 4px; align-items: center;">
						<div style="display: flex; align-items: center; gap: 2px; flex: 1;">
							<span style="font-size: 9px; color: var(--text-secondary);">W (mm):</span>
							<input type="text" id="toolbar-chart-width" value="${props.width || '120'}" style="height: 20px; width: 36px; font-size: 9px; padding: 2px; text-align: center; border: 1px solid var(--border-color); background: var(--bg-input); color: var(--text-primary);">
						</div>
						<div style="display: flex; align-items: center; gap: 2px; flex: 1;">
							<span style="font-size: 9px; color: var(--text-secondary);">H (mm):</span>
							<input type="text" id="toolbar-chart-height" value="${props.height || '90'}" style="height: 20px; width: 36px; font-size: 9px; padding: 2px; text-align: center; border: 1px solid var(--border-color); background: var(--bg-input); color: var(--text-primary);">
						</div>
						<button class="btn" id="toolbar-chart-apply-size" style="font-size: 9px; padding: 2px 6px; height: 20px; width: auto;">Set</button>
					</div>
				</div>
			`;
		}
		
		contextToolbar.innerHTML = html;
		bindToolbarListeners(type);
	}

	// Helper to bind toolbar click / select events
	function bindToolbarListeners(type) {
		if (type === "text") {
			const runTextCmd = (fn) => {
				window.Asc.plugin.callCommand(fn, false, true, () => {
					debouncedRefresh();
				});
			};

			document.getElementById("toolbar-bold").addEventListener("click", () => {
				runTextCmd(function() {
					var oRange = Api.GetDocument().GetRangeBySelect();
					if (oRange) oRange.SetBold(!oRange.GetBold());
				});
			});

			document.getElementById("toolbar-italic").addEventListener("click", () => {
				runTextCmd(function() {
					var oRange = Api.GetDocument().GetRangeBySelect();
					if (oRange) oRange.SetItalic(!oRange.GetItalic());
				});
			});

			document.getElementById("toolbar-underline").addEventListener("click", () => {
				runTextCmd(function() {
					var oRange = Api.GetDocument().GetRangeBySelect();
					if (oRange) oRange.SetUnderline(!oRange.GetUnderline());
				});
			});

			document.getElementById("toolbar-strikeout").addEventListener("click", () => {
				runTextCmd(function() {
					var oRange = Api.GetDocument().GetRangeBySelect();
					if (oRange) oRange.SetStrikeout(!oRange.GetStrikeout());
				});
			});

			const setAlign = (jc) => {
				runTextCmd(function() {
					var oRange = Api.GetDocument().GetRangeBySelect();
					if (oRange) {
						var pList = oRange.GetAllParagraphs();
						for (var i = 0; i < pList.length; i++) {
							pList[i].SetJc(Asc.scope.jc);
						}
					}
				});
			};

			document.getElementById("toolbar-align-left").addEventListener("click", () => {
				window.Asc.scope.jc = "left";
				setAlign("left");
			});
			document.getElementById("toolbar-align-center").addEventListener("click", () => {
				window.Asc.scope.jc = "center";
				setAlign("center");
			});
			document.getElementById("toolbar-align-right").addEventListener("click", () => {
				window.Asc.scope.jc = "right";
				setAlign("right");
			});
			document.getElementById("toolbar-align-justify").addEventListener("click", () => {
				window.Asc.scope.jc = "both";
				setAlign("both");
			});

			document.getElementById("toolbar-font-family").addEventListener("change", (e) => {
				window.Asc.scope.fontName = e.target.value;
				runTextCmd(function() {
					var oRange = Api.GetDocument().GetRangeBySelect();
					if (oRange) oRange.SetFontName(Asc.scope.fontName);
				});
			});

			document.getElementById("toolbar-font-size").addEventListener("change", (e) => {
				window.Asc.scope.fontSize = parseInt(e.target.value) * 2;
				runTextCmd(function() {
					var oRange = Api.GetDocument().GetRangeBySelect();
					if (oRange) oRange.SetFontSize(Asc.scope.fontSize);
				});
			});

			document.getElementById("toolbar-font-color").addEventListener("change", (e) => {
				const hex = e.target.value.replace('#', '');
				window.Asc.scope.r = parseInt(hex.substring(0, 2), 16);
				window.Asc.scope.g = parseInt(hex.substring(2, 4), 16);
				window.Asc.scope.b = parseInt(hex.substring(4, 6), 16);
				runTextCmd(function() {
					var oRange = Api.GetDocument().GetRangeBySelect();
					if (oRange) oRange.SetColor(Asc.scope.r, Asc.scope.g, Asc.scope.b);
				});
			});

			document.getElementById("toolbar-shading-color").addEventListener("change", (e) => {
				const hex = e.target.value.replace('#', '');
				window.Asc.scope.r = parseInt(hex.substring(0, 2), 16);
				window.Asc.scope.g = parseInt(hex.substring(2, 4), 16);
				window.Asc.scope.b = parseInt(hex.substring(4, 6), 16);
				runTextCmd(function() {
					var oRange = Api.GetDocument().GetRangeBySelect();
					if (oRange) {
						var pList = oRange.GetAllParagraphs();
						for (var i = 0; i < pList.length; i++) {
							pList[i].SetShd(Asc.scope.r, Asc.scope.g, Asc.scope.b);
						}
					}
				});
			});

		} else if (type === "table") {
			const runTableCmd = (fn) => {
				window.Asc.plugin.callCommand(fn, false, true, () => {
					debouncedRefresh();
				});
			};

			document.getElementById("toolbar-table-row-above").addEventListener("click", () => {
				runTableCmd(function() {
					var getActiveCellAndTable = function() {
						var r = Api.GetDocument().GetRangeBySelect();
						if (!r) return null;
						var p = r.GetAllParagraphs();
						if (!p || !p.length) return null;
						var t = p[0].GetParentTable();
						if (!t) return null;
						for (var rIdx = 0; rIdx < t.GetRowsCount(); rIdx++) {
							var row = t.GetRow(rIdx);
							for (var cIdx = 0; cIdx < row.GetCellsCount(); cIdx++) {
								var cell = row.GetCell(cIdx);
								var paras = cell.GetContent().GetAllParagraphs();
								for (var cp = 0; cp < paras.length; cp++) {
									if (paras[cp] === p[0]) return { table: t, cell: cell, pList: p };
								}
							}
						}
						return null;
					};
					var res = getActiveCellAndTable();
					if (res && res.cell) {
						res.table.AddRow(res.cell, true);
					}
				});
			});

			document.getElementById("toolbar-table-row-below").addEventListener("click", () => {
				runTableCmd(function() {
					var getActiveCellAndTable = function() {
						var r = Api.GetDocument().GetRangeBySelect();
						if (!r) return null;
						var p = r.GetAllParagraphs();
						if (!p || !p.length) return null;
						var t = p[0].GetParentTable();
						if (!t) return null;
						for (var rIdx = 0; rIdx < t.GetRowsCount(); rIdx++) {
							var row = t.GetRow(rIdx);
							for (var cIdx = 0; cIdx < row.GetCellsCount(); cIdx++) {
								var cell = row.GetCell(cIdx);
								var paras = cell.GetContent().GetAllParagraphs();
								for (var cp = 0; cp < paras.length; cp++) {
									if (paras[cp] === p[0]) return { table: t, cell: cell, pList: p };
								}
							}
						}
						return null;
					};
					var res = getActiveCellAndTable();
					if (res && res.cell) {
						res.table.AddRow(res.cell, false);
					}
				});
			});

			document.getElementById("toolbar-table-col-left").addEventListener("click", () => {
				runTableCmd(function() {
					var getActiveCellAndTable = function() {
						var r = Api.GetDocument().GetRangeBySelect();
						if (!r) return null;
						var p = r.GetAllParagraphs();
						if (!p || !p.length) return null;
						var t = p[0].GetParentTable();
						if (!t) return null;
						for (var rIdx = 0; rIdx < t.GetRowsCount(); rIdx++) {
							var row = t.GetRow(rIdx);
							for (var cIdx = 0; cIdx < row.GetCellsCount(); cIdx++) {
								var cell = row.GetCell(cIdx);
								var paras = cell.GetContent().GetAllParagraphs();
								for (var cp = 0; cp < paras.length; cp++) {
									if (paras[cp] === p[0]) return { table: t, cell: cell, pList: p };
								}
							}
						}
						return null;
					};
					var res = getActiveCellAndTable();
					if (res && res.cell) {
						res.table.AddColumn(res.cell, true);
					}
				});
			});

			document.getElementById("toolbar-table-col-right").addEventListener("click", () => {
				runTableCmd(function() {
					var getActiveCellAndTable = function() {
						var r = Api.GetDocument().GetRangeBySelect();
						if (!r) return null;
						var p = r.GetAllParagraphs();
						if (!p || !p.length) return null;
						var t = p[0].GetParentTable();
						if (!t) return null;
						for (var rIdx = 0; rIdx < t.GetRowsCount(); rIdx++) {
							var row = t.GetRow(rIdx);
							for (var cIdx = 0; cIdx < row.GetCellsCount(); cIdx++) {
								var cell = row.GetCell(cIdx);
								var paras = cell.GetContent().GetAllParagraphs();
								for (var cp = 0; cp < paras.length; cp++) {
									if (paras[cp] === p[0]) return { table: t, cell: cell, pList: p };
								}
							}
						}
						return null;
					};
					var res = getActiveCellAndTable();
					if (res && res.cell) {
						res.table.AddColumn(res.cell, false);
					}
				});
			});

			document.getElementById("toolbar-table-delete-row").addEventListener("click", () => {
				runTableCmd(function() {
					var getActiveCellAndTable = function() {
						var r = Api.GetDocument().GetRangeBySelect();
						if (!r) return null;
						var p = r.GetAllParagraphs();
						if (!p || !p.length) return null;
						var t = p[0].GetParentTable();
						if (!t) return null;
						for (var rIdx = 0; rIdx < t.GetRowsCount(); rIdx++) {
							var row = t.GetRow(rIdx);
							for (var cIdx = 0; cIdx < row.GetCellsCount(); cIdx++) {
								var cell = row.GetCell(cIdx);
								var paras = cell.GetContent().GetAllParagraphs();
								for (var cp = 0; cp < paras.length; cp++) {
									if (paras[cp] === p[0]) return { table: t, cell: cell, pList: p };
								}
							}
						}
						return null;
					};
					var res = getActiveCellAndTable();
					if (res && res.cell) {
						var table = res.table;
						var activeRowIndex = -1;
						var rowsCount = table.GetRowsCount();
						for (var r = 0; r < rowsCount; r++) {
							var row = table.GetRow(r);
							var cellsCount = row.GetCellsCount();
							for (var c = 0; c < cellsCount; c++) {
								if (row.GetCell(c) === res.cell) {
									activeRowIndex = r;
									break;
								}
							}
							if (activeRowIndex !== -1) break;
						}
						if (activeRowIndex !== -1) {
							table.RemoveRow(activeRowIndex);
						}
					}
				});
			});

			document.getElementById("toolbar-table-delete-col").addEventListener("click", () => {
				runTableCmd(function() {
					var getActiveCellAndTable = function() {
						var r = Api.GetDocument().GetRangeBySelect();
						if (!r) return null;
						var p = r.GetAllParagraphs();
						if (!p || !p.length) return null;
						var t = p[0].GetParentTable();
						if (!t) return null;
						for (var rIdx = 0; rIdx < t.GetRowsCount(); rIdx++) {
							var row = t.GetRow(rIdx);
							for (var cIdx = 0; cIdx < row.GetCellsCount(); cIdx++) {
								var cell = row.GetCell(cIdx);
								var paras = cell.GetContent().GetAllParagraphs();
								for (var cp = 0; cp < paras.length; cp++) {
									if (paras[cp] === p[0]) return { table: t, cell: cell, pList: p };
								}
							}
						}
						return null;
					};
					var res = getActiveCellAndTable();
					if (res && res.cell) {
						res.cell.RemoveColumn();
					}
				});
			});

			document.getElementById("toolbar-table-shading").addEventListener("change", (e) => {
				const hex = e.target.value.replace('#', '');
				window.Asc.scope.r = parseInt(hex.substring(0, 2), 16);
				window.Asc.scope.g = parseInt(hex.substring(2, 4), 16);
				window.Asc.scope.b = parseInt(hex.substring(4, 6), 16);
				runTableCmd(function() {
					var getActiveCellAndTable = function() {
						var r = Api.GetDocument().GetRangeBySelect();
						if (!r) return null;
						var p = r.GetAllParagraphs();
						if (!p || !p.length) return null;
						var t = p[0].GetParentTable();
						if (!t) return null;
						for (var rIdx = 0; rIdx < t.GetRowsCount(); rIdx++) {
							var row = t.GetRow(rIdx);
							for (var cIdx = 0; cIdx < row.GetCellsCount(); cIdx++) {
								var cell = row.GetCell(cIdx);
								var paras = cell.GetContent().GetAllParagraphs();
								for (var cp = 0; cp < paras.length; cp++) {
									if (paras[cp] === p[0]) return { table: t, cell: cell, pList: p };
								}
							}
						}
						return null;
					};
					var res = getActiveCellAndTable();
					if (res && res.table) {
						var colorObj = Api.CreateColorFromRGB(Asc.scope.r, Asc.scope.g, Asc.scope.b);
						var rowsCount = res.table.GetRowsCount();
						for (var rowIdx = 0; rowIdx < rowsCount; rowIdx++) {
							var row = res.table.GetRow(rowIdx);
							var cellsCount = row.GetCellsCount();
							for (var colIdx = 0; colIdx < cellsCount; colIdx++) {
								var cell = row.GetCell(colIdx);
								var cellParas = cell.GetContent().GetAllParagraphs();
								var isCellSelected = false;
								for (var cp = 0; cp < cellParas.length; cp++) {
									for (var sp = 0; sp < res.pList.length; sp++) {
										if (cellParas[cp] === res.pList[sp]) {
											isCellSelected = true;
											break;
										}
									}
									if (isCellSelected) break;
								}
								if (isCellSelected) {
									cell.SetBackgroundColor(colorObj);
								}
							}
						}
					}
				});
			});

		} else if (type === "image") {
			document.getElementById("toolbar-img-apply-size").addEventListener("click", () => {
				const w = parseFloat(document.getElementById("toolbar-img-width").value);
				const h = parseFloat(document.getElementById("toolbar-img-height").value);
				if (isNaN(w) || isNaN(h)) return;
				
				window.Asc.scope.width = w * 36000;
				window.Asc.scope.height = h * 36000;
				window.Asc.plugin.callCommand(function() {
					var oSelection = Api.GetSelection();
					if (oSelection) {
						try { oSelection.SetSize(Asc.scope.width, Asc.scope.height); } catch(e) {}
					}
				}, false, true, () => {
					debouncedRefresh();
				});
			});

			document.getElementById("toolbar-img-rotate").addEventListener("click", () => {
				window.Asc.plugin.callCommand(function() {
					var oSelection = Api.GetSelection();
					if (oSelection) {
						var r = 0;
						try { r = oSelection.GetRotation() || 0; } catch(e) {}
						try { oSelection.SetRotation((r + 90) % 360); } catch(e) {}
					}
				}, false, true, () => {
					debouncedRefresh();
				});
			});

		} else if (type === "shape") {
			document.getElementById("toolbar-shape-fill").addEventListener("change", (e) => {
				const hex = e.target.value.replace('#', '');
				window.Asc.scope.r = parseInt(hex.substring(0, 2), 16);
				window.Asc.scope.g = parseInt(hex.substring(2, 4), 16);
				window.Asc.scope.b = parseInt(hex.substring(4, 6), 16);
				window.Asc.plugin.callCommand(function() {
					var oSelection = Api.GetSelection();
					if (oSelection) {
						var colorObj = Api.CreateColorFromRGB(Asc.scope.r, Asc.scope.g, Asc.scope.b);
						var fill = Api.CreateSolidFill(colorObj);
						try { oSelection.SetFill(fill); } catch(e) {}
					}
				}, false, true, () => {
					debouncedRefresh();
				});
			});

			document.getElementById("toolbar-shape-outline").addEventListener("change", (e) => {
				const hex = e.target.value.replace('#', '');
				window.Asc.scope.r = parseInt(hex.substring(0, 2), 16);
				window.Asc.scope.g = parseInt(hex.substring(2, 4), 16);
				window.Asc.scope.b = parseInt(hex.substring(4, 6), 16);
				window.Asc.plugin.callCommand(function() {
					var oSelection = Api.GetSelection();
					if (oSelection) {
						var colorObj = Api.CreateColorFromRGB(Asc.scope.r, Asc.scope.g, Asc.scope.b);
						var stroke = Api.CreateStroke(12700, Api.CreateSolidFill(colorObj));
						try { oSelection.SetOutline(stroke); } catch(e) {}
					}
				}, false, true, () => {
					debouncedRefresh();
				});
			});

			document.getElementById("toolbar-shape-weight").addEventListener("change", (e) => {
				window.Asc.scope.weight = parseFloat(e.target.value) * 12700;
				window.Asc.plugin.callCommand(function() {
					var oSelection = Api.GetSelection();
					if (oSelection) {
						var stroke = Api.CreateStroke(Asc.scope.weight);
						try { oSelection.SetOutline(stroke); } catch(e) {}
					}
				}, false, true, () => {
					debouncedRefresh();
				});
			});

			document.getElementById("toolbar-shape-apply").addEventListener("click", () => {
				const w = parseFloat(document.getElementById("toolbar-shape-width").value);
				const h = parseFloat(document.getElementById("toolbar-shape-height").value);
				if (isNaN(w) || isNaN(h)) return;
				
				window.Asc.scope.width = w * 36000;
				window.Asc.scope.height = h * 36000;
				window.Asc.plugin.callCommand(function() {
					var oSelection = Api.GetSelection();
					if (oSelection) {
						try { oSelection.SetSize(Asc.scope.width, Asc.scope.height); } catch(e) {}
					}
				}, false, true, () => {
					debouncedRefresh();
				});
			});

		} else if (type === "chart") {
			document.getElementById("toolbar-chart-apply-title").addEventListener("click", () => {
				window.Asc.scope.title = document.getElementById("toolbar-chart-title").value;
				window.Asc.plugin.callCommand(function() {
					var oSelection = Api.GetSelection();
					if (oSelection) {
						try { oSelection.SetTitle(Asc.scope.title, 24); } catch(e) {}
					}
				}, false, true, () => {
					debouncedRefresh();
				});
			});

			document.getElementById("toolbar-chart-apply-size").addEventListener("click", () => {
				const w = parseFloat(document.getElementById("toolbar-chart-width").value);
				const h = parseFloat(document.getElementById("toolbar-chart-height").value);
				if (isNaN(w) || isNaN(h)) return;
				
				window.Asc.scope.width = w * 36000;
				window.Asc.scope.height = h * 36000;
				window.Asc.plugin.callCommand(function() {
					var oSelection = Api.GetSelection();
					if (oSelection) {
						try { oSelection.SetSize(Asc.scope.width, Asc.scope.height); } catch(e) {}
					}
				}, false, true, () => {
					debouncedRefresh();
				});
			});
		}
	}

	let lastSelectionType = null;
	async function updateDynamicToolbar() {
		try {
			const res = await detectSelectionType();
			if (res.type !== lastSelectionType) {
				lastSelectionType = res.type;
				renderContextToolbar(res.type, res.properties);
			}
		} catch(e) {
			console.error("Error updating toolbar:", e);
		}
	}

	// Execution Telemetry Debug State
	let lastExecutionDebugData = {
		timestamp: null,
		intent: null,
		serializationMode: null,
		userPrompt: null,
		systemPrompt: null,
		fullUserPrompt: null,
		rawResponse: null,
		parsedPlans: null,
		stateBefore: [],
		stateAfter: [],
		status: "No executions yet"
	};

	const debugViewerContent = document.getElementById('debug-viewer-content');
	const copyDebugLogBtn = document.getElementById('copy-debug-log');
	const clearDebugLogBtn = document.getElementById('clear-debug-log');

	function updateDebugViewer() {
		if (!debugViewerContent) return;
		
		if (!lastExecutionDebugData.timestamp) {
			debugViewerContent.textContent = "No execution data captured yet. Execute an AI command to see step-by-step telemetry logs here.";
			return;
		}

		const fullLog = `======================================================================
📋 AI PIPELINE TELEMETRY SUMMARY
======================================================================
Timestamp:          ${lastExecutionDebugData.timestamp || 'N/A'}
Status:             ${lastExecutionDebugData.status || 'N/A'}
Intent Router:      ${lastExecutionDebugData.intent || 'N/A'}
Serialization Mode: ${lastExecutionDebugData.serializationMode || 'N/A'}
User Prompt:        "${lastExecutionDebugData.userPrompt || ''}"
Logical Steps Count: ${lastExecutionDebugData.parsedPlans ? lastExecutionDebugData.parsedPlans.length : 0}

======================================================================
💬 ACTIVE LLM PROMPTS
======================================================================
--- SYSTEM PROMPT (RULES INJECTED) ---
${lastExecutionDebugData.systemPrompt || 'N/A'}

--- USER MESSAGE (EXTRACTED CONTEXT & PROMPT) ---
${lastExecutionDebugData.fullUserPrompt || 'N/A'}

======================================================================
🔍 DOCUMENT STATE BEFORE CHANGES
======================================================================
${JSON.stringify(lastExecutionDebugData.stateBefore, null, 2)}

======================================================================
✨ DOCUMENT STATE AFTER CHANGES (WITH VERIFICATION OUTPUT)
======================================================================
${JSON.stringify(lastExecutionDebugData.stateAfter, null, 2)}

======================================================================
🤖 RAW LLM RESPONSE & ACTIONS DECODED
======================================================================
--- RAW RESPONSE ---
${lastExecutionDebugData.rawResponse || 'N/A'}

--- DECODED PLAN STEPS ---
${JSON.stringify(lastExecutionDebugData.parsedPlans || [], null, 2)}
`;

		debugViewerContent.textContent = fullLog;
	}

	if (copyDebugLogBtn) {
		copyDebugLogBtn.addEventListener('click', () => {
			const text = debugViewerContent.textContent;
			if (!text || text.startsWith("No execution data")) return;
			navigator.clipboard.writeText(text).then(() => {
				const originalText = copyDebugLogBtn.innerText;
				copyDebugLogBtn.innerText = "Copied! ✓";
				setTimeout(() => { copyDebugLogBtn.innerText = originalText; }, 1500);
			});
		});
	}

	if (clearDebugLogBtn) {
		clearDebugLogBtn.addEventListener('click', () => {
			lastExecutionDebugData = {
				timestamp: null,
				intent: null,
				serializationMode: null,
				userPrompt: null,
				systemPrompt: null,
				fullUserPrompt: null,
				rawResponse: null,
				parsedPlans: null,
				stateBefore: [],
				stateAfter: [],
				status: "No executions yet"
			};
			updateDebugViewer();
			log("Cleared execution debugger telemetry logs.", "info");
		});
	}

	// Supported Intents for the Router Layer
	const INTENTS = {
		REWRITE: "rewrite",
		SUMMARIZE: "summarize",
		TRANSLATE: "translate",
		FORMAT: "format",
		CREATE_DOCUMENT: "create_document",
		INSERT_CONTENT: "insert_content",
		DELETE_CONTENT: "delete_content",
		RESTRUCTURE: "restructure",
		ANALYZE: "analyze"
	};

	// Local Rule Engine rules per intent
	const RULES = {
		rewrite: {
			instructions: "1. Focus ONLY on writing beautiful, professional, context-appropriate text.\n2. Do NOT change visual styling properties (bold, italic, font family) in this plan unless explicitly requested.\n3. Return a high-level action 'rewrite' for the paragraph indices to update.\n4. Output valid JSON in the Planner format."
		},
		summarize: {
			instructions: "1. Condense the text into 3 to 5 clear, high-quality, professional bullet points starting with standard dash '-' prefixes.\n2. Return a high-level action 'paste_html' or 'rewrite' with the summary bullets.\n3. Do not generate visual changes unless asked."
		},
		translate: {
			instructions: "1. Translate the text into the target language with perfect grammatical accuracy.\n2. Keep paragraph structure identical. Do not alter styling.\n3. Return a 'rewrite' action for the paragraph indices."
		},
		format: {
			instructions: "1. Focus ONLY on styling (fontName, fontSize, bold, italic, color, alignment, spacing, shading, lists, and indentation).\n2. Do NOT rewrite the text content of the paragraphs unless explicitly requested.\n3. Return 'change_font', 'change_color', 'make_list', 'change_indent', or 'table_action' high-level actions depending on styling or layout goals."
		},
		create_document: {
			instructions: "1. Generate a beautifully structured document, essay, report, or article using professional formatting rules.\n2. Heavily use 'paste_html' action with high-fidelity styled HTML strings.\n3. Create proper heading hierarchies (<h1 style='...'>, <h2 style='...'>, <p style='text-align:justify;'>)."
		},
		insert_content: {
			instructions: "1. Insert new paragraphs or tables at the correct target index.\n2. Return 'create_paragraph', 'paste_html', or 'table_action' (subAction: 'create', 'add_row', 'add_column') high-level actions with proper text or parameters."
		},
		delete_content: {
			instructions: "1. Remove targeted content, paragraphs, tables, or sections.\n2. Return 'delete_paragraph' or 'table_action' (subAction: 'delete_row', 'delete_column') high-level actions."
		},
		restructure: {
			instructions: "1. Reorganize headings, change layouts or margins.\n2. Return correct sequence of high-level actions (delete, create, format) to achieve structure."
		},
		analyze: {
			instructions: "1. Read document text and identify issues, grammar, tone, flow.\n2. Return logical list of rewrite actions to correct found issues."
		}
	};

	// View Tabs Navigation
	function switchTab(activeTab, activeView, titleText) {
		[tabPrompt, tabStructure, tabConsole, tabSettings].forEach(tab => {
			if (tab) tab.classList.toggle('active', tab === activeTab);
		});
		[viewPrompt, viewStructure, viewConsole, viewSettings].forEach(view => {
			if (view) view.classList.toggle('active', view === activeView);
		});
		const activeViewTitle = document.getElementById('active-view-title');
		if (activeViewTitle) {
			activeViewTitle.innerText = titleText;
		}
	}

	tabPrompt.addEventListener('click', () => switchTab(tabPrompt, viewPrompt, 'Chat Assistant'));
	tabStructure.addEventListener('click', () => {
		switchTab(tabStructure, viewStructure, 'Document Outline');
		refreshDocStructureView();
	});
	tabConsole.addEventListener('click', () => switchTab(tabConsole, viewConsole, 'Dev Console'));
	tabSettings.addEventListener('click', () => {
		switchTab(tabSettings, viewSettings, 'Settings');
		renderCheckpointsUI();
	});

	// Dev Console inner tabs
	if (btnTabLogs && btnTabTelemetry) {
		btnTabLogs.addEventListener('click', () => {
			btnTabLogs.classList.add('active');
			btnTabTelemetry.classList.remove('active');
			paneLogs.classList.add('active');
			paneTelemetry.classList.remove('active');
		});
		btnTabTelemetry.addEventListener('click', () => {
			btnTabTelemetry.classList.add('active');
			btnTabLogs.classList.remove('active');
			paneTelemetry.classList.add('active');
			paneLogs.classList.remove('active');
		});
	}

	// Slash Command Popup Autocomplete Menu
	if (promptInput && slashMenu) {
		promptInput.addEventListener('input', (e) => {
			const val = e.target.value;
			if (val === '/') {
				slashMenu.style.display = 'block';
				// select first item
				const items = slashMenu.querySelectorAll('.slash-item');
				items.forEach((item, idx) => {
					item.classList.toggle('selected', idx === 0);
				});
			} else if (!val.startsWith('/')) {
				slashMenu.style.display = 'none';
			}
		});

		document.addEventListener('click', (e) => {
			if (!e.target.closest('#chat-input-bar') && !e.target.closest('#slash-menu')) {
				slashMenu.style.display = 'none';
			}
		});

		slashMenu.querySelectorAll('.slash-item').forEach(item => {
			item.addEventListener('click', () => {
				const cmd = item.getAttribute('data-cmd');
				promptInput.value = cmd + ' ';
				slashMenu.style.display = 'none';
				promptInput.focus();
			});
		});
	}

	// Selection Context Scope Badge is updated dynamically by refreshDocStructureView

	// Scan range is now dynamic and automatic

	// API Key Visibility Toggle
	toggleKeyVisibility.addEventListener('click', () => {
		if (apiKeyInput.type === 'password') {
			apiKeyInput.type = 'text';
			toggleKeyVisibility.innerText = 'HIDE';
		} else {
			apiKeyInput.type = 'password';
			toggleKeyVisibility.innerText = 'SHOW';
		}
	});

	// Accordion toggle handler for Settings cards
	document.querySelectorAll('.card-header').forEach(header => {
		header.addEventListener('click', (e) => {
			if (e.target.closest('#copy-debug-log') || e.target.closest('#clear-debug-log') || e.target.closest('#clear-logs') || e.target.closest('#copy-log-file-btn') || e.target.closest('#reset-logs')) {
				return; // Prevent toggle when clicking header actions
			}
			const body = header.nextElementSibling;
			const chevron = header.querySelector('.accordion-chevron');
			if (body && body.classList.contains('card-body')) {
				if (body.style.display === 'none' || body.style.display === '') {
					body.style.display = 'block';
					if (chevron) chevron.innerText = '▼';
				} else {
					body.style.display = 'none';
					if (chevron) chevron.innerText = '►';
				}
			}
		});
	});

	// Copy Developer Log File click handler
	const copyLogFileBtn = document.getElementById('copy-log-file-btn');
	if (copyLogFileBtn) {
		copyLogFileBtn.addEventListener('click', () => {
			const logContent = logLines.length > 0 ? logLines.join('\n') : "No log entries recorded yet.";
			navigator.clipboard.writeText(logContent).then(() => {
				log('Copied all developer logs to clipboard.', 'success');
				copyLogFileBtn.innerText = 'Copied!';
				setTimeout(() => {
					copyLogFileBtn.innerText = 'Copy Log';
				}, 1500);
			}).catch(err => {
				log('Failed to copy logs: ' + err.message, 'error');
			});
		});
	}

	// Available models with relative cost mappings
	const providerModels = {
		groq: [
			{ value: 'llama-3.3-70b-versatile', text: 'Llama 3.3 70B (Recommended) [0.5x cost]', cost: '0.5x' },
			{ value: 'llama-3.1-8b-instant', text: 'Llama 3.1 8B (Fast) [0.05x cost]', cost: '0.05x' },
			{ value: 'llama-3.2-3b-preview', text: 'Llama 3.2 3B (Lightweight) [0.02x cost]', cost: '0.02x' },
			{ value: 'llama-3.2-1b-preview', text: 'Llama 3.2 1B (Ultra-fast) [0.01x cost]', cost: '0.01x' },
			{ value: 'deepseek-r1-distill-qwen-32b', text: 'DeepSeek R1 32B (Reasoning) [0.2x cost]', cost: '0.2x' },
			{ value: 'deepseek-r1-distill-llama-70b', text: 'DeepSeek R1 70B (Reasoning) [0.5x cost]', cost: '0.5x' }
		]
	};

	// Initialize active provider select options
	function initializeProvider() {
		// Populate Groq models
		modelSelect.innerHTML = providerModels.groq.map(m => `<option value="${m.value}">${m.text}</option>`).join('');
		
		const savedGroqModel = localStorage.getItem('groq_copilot_model') || 'llama-3.3-70b-versatile';
		modelSelect.value = savedGroqModel;
		localStorage.setItem('groq_copilot_model', savedGroqModel);
		
		// Render dynamic cost indicator badge
		updateCostBadge();
	}

	// Update Dynamic Model Relative Cost Badge
	function updateCostBadge() {
		if (!modelCostBadge || !modelSelect) return;
		
		const currentModel = modelSelect.value;
		const models = providerModels.groq;
		const selectedModel = models.find(m => m.value === currentModel);
		
		if (selectedModel && selectedModel.cost) {
			const costVal = parseFloat(selectedModel.cost.replace('x', ''));
			modelCostBadge.innerText = selectedModel.cost + ' Cost';
			modelCostBadge.style.display = 'inline-block';
			
			// Dynamic color schemes (Tokyo Night Tailored HSL color tones)
			if (costVal < 0.3) {
				// Green (Ultra efficient)
				modelCostBadge.style.color = '#10b981';
				modelCostBadge.style.borderColor = 'rgba(16, 185, 129, 0.3)';
				modelCostBadge.style.background = 'rgba(16, 185, 129, 0.1)';
			} else if (costVal <= 1.0) {
				// Orange (Medium resource weight)
				modelCostBadge.style.color = '#f59e0b';
				modelCostBadge.style.borderColor = 'rgba(245, 158, 11, 0.3)';
				modelCostBadge.style.background = 'rgba(245, 158, 11, 0.1)';
			} else {
				// Coral/Red (Flagship/Premium engines)
				modelCostBadge.style.color = '#f43f5e';
				modelCostBadge.style.borderColor = 'rgba(244, 63, 94, 0.3)';
				modelCostBadge.style.background = 'rgba(244, 63, 94, 0.1)';
			}
		} else {
			modelCostBadge.style.display = 'none';
		}
	}

	// Load Saved Settings from localStorage
	function loadSettings() {
		const savedKey = localStorage.getItem('groq_copilot_key');

		if (savedKey) {
			apiKeyInput.value = savedKey;
		}

		initializeProvider();
		log('OneScript settings loaded securely.', 'success');
	}

	// Save API Key Actions
	saveKeyBtn.addEventListener('click', () => {
		const key = apiKeyInput.value.trim();
		if (!key) {
			log('Error: Key cannot be empty.', 'error');
			return;
		}
		localStorage.setItem('groq_copilot_key', key);
		log('Groq API Key saved successfully!', 'success');
		tabPrompt.click(); // Switch back to editor tab
	});

	// Remove API Key Actions
	removeKeyBtn.addEventListener('click', () => {
		localStorage.removeItem('groq_copilot_key');
		apiKeyInput.value = '';
		log('Groq API Key removed from local storage.', 'warning');
	});

	// Save Model Choice on select and update cost indicator
	modelSelect.addEventListener('change', () => {
		localStorage.setItem('groq_copilot_model', modelSelect.value);
		log(`Model switched to Groq: ${modelSelect.value}`, 'info');
		updateCostBadge();
	});

	// Suggestion Chips handler
	document.querySelectorAll('.chip').forEach(chip => {
		if (chip.id === 'chip-summarize') return; // Skip special chip
		chip.addEventListener('click', () => {
			promptInput.value = chip.getAttribute('data-prompt');
			promptInput.focus();
		});
	});

	// Logging persistence helpers
	function loadLogFile() {
		const savedLog = localStorage.getItem(logStorageKey);
		logLines = savedLog ? savedLog.split('\n').filter(Boolean) : [];
	}

	function clearLogFile() {
		logLines = [];
		localStorage.removeItem(logStorageKey);
		log('Developer log file cleared.', 'warning');
	}

	function downloadLogFile() {
		const logContent = logLines.length > 0 ? logLines.join('\n') : "No log entries recorded yet.";
		const blob = new Blob([logContent + '\n'], { type: 'text/plain;charset=utf-8' });
		const url = URL.createObjectURL(blob);
		const link = document.createElement('a');
		link.href = url;
		link.download = `onescript-log-${new Date().toISOString().replace(/[:.]/g, '-')}.log`;
		document.body.appendChild(link);
		link.click();
		link.remove();
		setTimeout(() => URL.revokeObjectURL(url), 0);
	}

	// Persistent logs event handlers
	if (clearLogsBtn) {
		clearLogsBtn.addEventListener('click', () => {
			downloadLogFile();
			log('Downloaded the stored log file.', 'info');
		});
	}

	if (resetLogsBtn) {
		resetLogsBtn.addEventListener('click', () => {
			clearLogFile();
		});
	}

	// Logger helper
	function log(message, type = 'default') {
		const timestamp = new Date().toISOString();
		const line = `[${timestamp}] [${type.toUpperCase()}] ${message}`;
		logLines.push(line);
		localStorage.setItem(logStorageKey, logLines.join('\n'));
		if (typeof console !== 'undefined' && console.log) {
			console.log(line);
		}
		if (logContainer) {
			const entry = document.createElement('div');
			entry.className = `log-entry ${type}`;
			entry.innerHTML = `<span>[${new Date().toLocaleTimeString()}]</span> <span>${message}</span>`;
			logContainer.appendChild(entry);
			logContainer.scrollTop = logContainer.scrollHeight;
		}
	}

	// Render Interactive Outline Tree Map
	function renderOutlineTree(parsed, container) {
		container.innerHTML = '';
		if (!parsed || !parsed.sections || parsed.sections.length === 0) {
			container.innerHTML = '<div class="outline-empty">No outline elements found.</div>';
			return;
		}

		// Create metadata header/indicator
		const metaHeader = document.createElement('div');
		metaHeader.className = 'outline-meta-header';
		metaHeader.innerHTML = `
			<span class="meta-mode">${parsed.mode === 'selection' ? 'Selection' : 'Entire Document'}</span>
			<span class="meta-count">${parsed.metadata.totalElements} elements</span>
		`;
		container.appendChild(metaHeader);

		parsed.sections.forEach((section, sIdx) => {
			// Create Section Node
			const sectionNode = document.createElement('div');
			sectionNode.className = 'outline-section-node';
			
			const sectionTitle = document.createElement('div');
			sectionTitle.className = 'outline-section-title';
			sectionTitle.innerHTML = `
				<span class="section-caret">▼</span>
				<span class="section-icon">📂</span>
				<span class="section-label" title="${section.title}">${section.title}</span>
			`;
			sectionNode.appendChild(sectionTitle);
			
			const sectionElements = document.createElement('div');
			sectionElements.className = 'outline-section-elements';
			
			if (section.elements && section.elements.length > 0) {
				section.elements.forEach(el => {
					const elNode = document.createElement('div');
					elNode.className = `outline-el-node type-${el.type}`;
					if (parsed.metadata.cursorIndex === el.index) {
						elNode.classList.add('caret-focus');
					}
					
					let icon = '📝';
					let displayText = el.text ? el.text.trim() : '';
					let detailBadge = '';
					
					if (el.type === 'table') {
						icon = '🗂️';
						const rows = el.rows ? el.rows.length : 0;
						const cols = el.rows && el.rows[0] && el.rows[0].cells ? el.rows[0].cells.length : 0;
						displayText = `Table (${rows}x${cols})`;
						detailBadge = `<span class="el-badge table">TABLE</span>`;
					} else if (el.type === 'paragraph') {
						if (el.style) {
							if (el.style.styleName) {
								const isHeading = el.style.styleName.toLowerCase().includes('heading');
								if (isHeading) {
									icon = '🏷️';
									elNode.classList.add('heading-node');
									detailBadge = `<span class="el-badge heading">${el.style.styleName.replace(/heading/i, 'H')}</span>`;
								} else if (el.style.listType) {
									icon = el.style.listType === 'numbered' ? '🔢' : '•';
									detailBadge = `<span class="el-badge list">LIST</span>`;
								}
							}
						}
						if (!displayText) {
							displayText = '[Empty Paragraph]';
							elNode.classList.add('empty-node');
						}
					}
					
					// Style overrides
					let styleAttr = '';
					if (el.style) {
						if (el.style.bold) styleAttr += 'font-weight: bold;';
						if (el.style.italic) styleAttr += 'font-style: italic;';
						if (el.style.underline) styleAttr += 'text-decoration: underline;';
						if (el.style.color && el.style.color !== '#000000') styleAttr += `color: ${el.style.color};`;
					}
					
					elNode.innerHTML = `
						<span class="el-icon">${icon}</span>
						<span class="el-text" style="${styleAttr}" title="${el.text || ''}">${displayText.substring(0, 45)}${displayText.length > 45 ? '...' : ''}</span>
						<div class="el-meta">
							${detailBadge}
							<span class="el-index">#${el.index + 1}</span>
						</div>
					`;
					
					// Click handler to select paragraph in ONLYOFFICE!
					elNode.addEventListener('click', () => {
						// Remove active focus class from others
						container.querySelectorAll('.outline-el-node').forEach(node => node.classList.remove('active-focus'));
						elNode.classList.add('active-focus');
						
						log(`Selecting Document Element #${el.index + 1} in editor...`, 'info');
						window.Asc.scope.targetSelectIndex = el.index;
						window.Asc.plugin.callCommand(function() {
							var oDocument = Api.GetDocument();
							var oElement = oDocument.GetElement(Asc.scope.targetSelectIndex);
							if (oElement) {
								try {
									oElement.Select();
								} catch(err) {
									return "err: " + err.message;
								}
								return "success";
							}
							return "notfound";
						}, false, true, function(res) {
							if (res && res.indexOf("err") !== -1) {
								log("Error selecting element: " + res, "error");
							} else if (res === "notfound") {
								log("Element not found in document.", "warning");
							} else {
								log(`Element #${el.index + 1} selected.`, "success");
							}
						});
					});
					
					sectionElements.appendChild(elNode);
				});
			} else {
				sectionElements.innerHTML = '<div class="outline-empty-section">No elements in section</div>';
			}
			
			sectionNode.appendChild(sectionElements);
			
			// Toggle section collapse/expand
			sectionTitle.addEventListener('click', () => {
				const isCollapsed = sectionElements.style.display === 'none';
				sectionElements.style.display = isCollapsed ? 'flex' : 'none';
				sectionTitle.querySelector('.section-caret').innerText = isCollapsed ? '▼' : '►';
			});
			
			container.appendChild(sectionNode);
		});
	}

	// Dynamic Document JSON Viewer compiler (debounced and fully dynamic)
	let isScanning = false;
	let scanPending = false;
	let isEditingAutonomously = false;
	async function refreshDocStructureView() {
		if (isEditingAutonomously) return;
		if (isScanning) {
			scanPending = true;
			return;
		}
		isScanning = true;
		scanPending = false;

		if (outlineTreeContainer) {
			outlineTreeContainer.classList.add('scanning-refreshed');
			if (outlineTreeContainer.innerHTML === '' || outlineTreeContainer.querySelector('.outline-loading')) {
				outlineTreeContainer.innerHTML = '<div class="outline-loading">Scanning document...</div>';
			}
		}
		structureJson.value = "Scanning active document structure JSON...";
		try {
			const docJSON = await serializeActiveContent();
			const parsed = JSON.parse(docJSON);
			structureJson.value = JSON.stringify(parsed, null, 2);

			// Render Outline Tree Map
			if (outlineTreeContainer) {
				renderOutlineTree(parsed, outlineTreeContainer);
			}

			// Update the context scope badge
			const badge = document.getElementById('prompt-scope-badge');
			if (badge) {
				const hasSelection = parsed.mode === 'selection';
				badge.innerText = hasSelection ? 'Selection' : 'Entire Doc';
				badge.style.borderColor = hasSelection ? 'rgba(16, 185, 129, 0.4)' : 'rgba(122, 162, 247, 0.3)';
				badge.style.color = hasSelection ? 'var(--accent-green)' : 'var(--primary)';
				badge.style.background = hasSelection ? 'rgba(16, 185, 129, 0.08)' : 'var(--primary-glow)';
			}

			log(`Compiled structural JSON successfully [Mode: ${parsed.mode}].`, "success");
		} catch(err) {
			structureJson.value = "Error scanning document structure: " + err.message;
			if (outlineTreeContainer) outlineTreeContainer.innerHTML = `<div class="outline-error">Error scanning structure: ${err.message}</div>`;
			log("Error loading structure: " + err.message, "error");
		} finally {
			isScanning = false;
			if (outlineTreeContainer) {
				outlineTreeContainer.classList.remove('scanning-refreshed');
			}
			if (scanPending) {
				setTimeout(refreshDocStructureView, 50);
			}
		}
	}

	// Copy document JSON structure
	copyStructure.addEventListener('click', () => {
		const txt = structureJson.value;
		if (!txt || txt.startsWith("Scanning") || txt.startsWith("Error")) return;
		
		navigator.clipboard.writeText(txt).then(() => {
			const originalText = copyStructure.innerText;
			copyStructure.innerText = "Copied! ✓";
			setTimeout(() => {
				copyStructure.innerText = originalText;
			}, 1500);
			log("Copied structural document JSON to clipboard.", "success");
		}).catch(() => {
			log("Failed to copy JSON to clipboard.", "error");
		});
	});

	// Refresh document JSON structure
	refreshStructure.addEventListener('click', () => {
		refreshDocStructureView();
	});

	// Toggle view modes (Tree / JSON) in Outline
	if (toggleViewOutline && toggleViewJson && outlineTreeContainer && structureJson) {
		toggleViewOutline.addEventListener('click', () => {
			toggleViewOutline.classList.add('active');
			toggleViewJson.classList.remove('active');
			outlineTreeContainer.style.display = 'block';
			structureJson.style.display = 'none';
			copyStructure.style.display = 'none';
		});
		
		toggleViewJson.addEventListener('click', () => {
			toggleViewJson.classList.add('active');
			toggleViewOutline.classList.remove('active');
			outlineTreeContainer.style.display = 'none';
			structureJson.style.display = 'block';
			copyStructure.style.display = 'inline-block';
		});
	}

	// Session Checkpoint Snapshots
	saveCheckpointBtn.addEventListener('click', () => {
		saveCheckpoint();
	});

	async function saveCheckpoint() {
		log("Capturing active document snapshot...", "info");
		try {
			const docJSON = await serializeActiveContent();
			const snapshot = JSON.parse(docJSON);
			const cp = {
				timestamp: new Date().toLocaleTimeString(),
				data: snapshot
			};
			checkpoints.push(cp);
			log(`Successfully saved session Checkpoint #${checkpoints.length}!`, 'success');
			renderCheckpointsUI();
		} catch (err) {
			log(`Failed to save checkpoint: ${err.message}`, 'error');
		}
	}

	async function saveAutoCheckpoint(promptText) {
		log("Capturing auto-checkpoint before execution...", "info");
		try {
			const docJSON = await serializeActiveContent();
			const snapshot = JSON.parse(docJSON);
			const cp = {
				timestamp: new Date().toLocaleTimeString(),
				prompt: promptText,
				data: snapshot
			};
			checkpoints.push(cp);
			log(`Automatically saved checkpoint before prompt: "${promptText.substring(0, 20)}..."`, 'success');
			renderCheckpointsUI();
		} catch (err) {
			log(`Failed to save auto-checkpoint: ${err.message}`, 'error');
		}
	}

	function renderCheckpointsUI() {
		if (!checkpointsList) return;
		if (checkpoints.length === 0) {
			checkpointsList.innerHTML = `<div style="font-size: 11px; color: var(--text-secondary); text-align: center; padding: 8px;">No checkpoints saved yet.</div>`;
			return;
		}
		checkpointsList.innerHTML = '';
		checkpoints.forEach((cp, index) => {
			const item = document.createElement('div');
			item.className = 'checkpoint-item';
			const label = cp.prompt ? `Auto: "${cp.prompt.substring(0, 18)}${cp.prompt.length > 18 ? '...' : ''}"` : `Snapshot #${index + 1}`;
			item.innerHTML = `
				<div class="checkpoint-info" style="display: flex; flex-direction: column; gap: 2px;">
					<span class="checkpoint-label" style="font-weight: 600; font-size: 10.5px; color: var(--text-primary); text-overflow: ellipsis; overflow: hidden; white-space: nowrap; max-width: 140px;" title="${cp.prompt || ''}">${label}</span>
					<span class="checkpoint-time" style="font-size: 9px; color: var(--text-muted);">${cp.timestamp}</span>
				</div>
				<button class="checkpoint-restore-btn" data-index="${index}" style="padding: 4px 8px; font-size: 9.5px; border-radius: var(--border-radius-boxy);">Restore</button>
			`;
			checkpointsList.appendChild(item);
		});

		checkpointsList.querySelectorAll('.checkpoint-restore-btn').forEach(btn => {
			btn.addEventListener('click', () => {
				const idx = parseInt(btn.getAttribute('data-index'));
				restoreCheckpoint(idx);
			});
		});
	}

	async function restoreCheckpoint(index) {
		const cp = checkpoints[index];
		if (!cp) return;
		log(`Restoring document state to Checkpoint #${index + 1}...`, 'info');
		
		let restoreChanges = [];
		cp.data.sections.forEach(s => {
			s.elements.forEach(el => {
				if (el.type === "paragraph") {
					var props = {
						newText: el.text || ""
					};
					if (el.style) {
						if (el.style.fontName) props.fontName = el.style.fontName;
						if (el.style.fontSize) props.fontSize = el.style.fontSize;
						props.bold = !!el.style.bold;
						props.italic = !!el.style.italic;
						props.underline = !!el.style.underline;
						props.strikeout = !!el.style.strikeout;
						if (el.style.color) props.color = el.style.color;
						if (el.style.alignment) props.alignment = el.style.alignment;
						if (el.style.spacingAfter !== undefined) props.spacingAfter = el.style.spacingAfter;
						if (el.style.spacingBefore !== undefined) props.spacingBefore = el.style.spacingBefore;
						if (el.style.lineSpacing !== undefined) props.lineSpacing = el.style.lineSpacing;
						if (el.style.shading !== undefined) props.shading = el.style.shading;
					}
					restoreChanges.push({
						action: "modifyStyle",
						targetIndex: el.index,
						properties: props
					});
				}
			});
		});
		
		executeSequentialEdits(restoreChanges);
	}

	// Helper to find document element by its absolute logical index inside our parsed structure
	function findElementByIndex(index) {
		if (!cachedDocData || !cachedDocData.sections) return null;
		for (var s = 0; s < cachedDocData.sections.length; s++) {
			var elements = cachedDocData.sections[s].elements;
			for (var e = 0; e < elements.length; e++) {
				if (elements[e].index === index) {
					return elements[e];
				}
			}
		}
		return null;
	}

	// Debounce helper to prevent performance lag during fast typing/movement
	function debounce(func, wait) {
		var timeout;
		return function() {
			var context = this, args = arguments;
			clearTimeout(timeout);
			timeout = setTimeout(function() {
				func.apply(context, args);
			}, wait);
		};
	}

	var debouncedRefresh = debounce(refreshDocStructureView, 250);

	// Dynamic theme handler to adapt to ONLYOFFICE editor light/dark mode
	window.Asc.plugin.onThemeChanged = function(theme) {
		if (window.Asc.plugin.onThemeChangedBase) {
			window.Asc.plugin.onThemeChangedBase(theme);
		}
		
		const isDark = theme.type === "dark" || theme.type === "contrast-dark";
		document.body.classList.toggle('theme-dark', isDark);
		document.body.classList.toggle('theme-light', !isDark);
		
		// Map any CSS variables passed from ONLYOFFICE to document root
		const root = document.documentElement;
		for (let key in theme) {
			if (key.startsWith('--')) {
				root.style.setProperty(key, theme[key]);
			} else {
				root.style.setProperty('--' + key, theme[key]);
			}
		}
		
		log('Theme adapted to OnlyOffice: ' + theme.type, 'info');
	};

	// Initialize ONLYOFFICE plugin hooks
	window.Asc.plugin.init = function() {
		loadLogFile();
		log('OneScript initialized.', 'success');
		loadSettings();
		
		// Attach to selection change event to dynamically update the JSON structure view instantly!
		try {
			this.attachEvent("onSelectionChanged", function() {
				debouncedRefresh();
				updateDynamicToolbar();
			});
		} catch(e) {}

		try {
			this.attachEvent("onTargetPositionChanged", function() {
				debouncedRefresh();
				updateDynamicToolbar();
			});
		} catch(e) {}
		
		// Initial scan and toolbar load
		refreshDocStructureView();
		updateDynamicToolbar();
	};

	// Fallback direct event assignments on the plugin object
	window.Asc.plugin.event_onSelectionChanged = function() {
		debouncedRefresh();
		updateDynamicToolbar();
	};
	window.Asc.plugin.event_onTargetPositionChanged = function() {
		debouncedRefresh();
		updateDynamicToolbar();
	};

	// Bind Undo / Redo toolbar events
	toolbarUndo.addEventListener('click', () => {
		window.Asc.plugin.executeMethod("Undo", [], () => {
			log("Executed document Undo successfully.", "info");
		});
	});

	toolbarRedo.addEventListener('click', () => {
		window.Asc.plugin.executeMethod("Redo", [], () => {
			log("Executed document Redo successfully.", "info");
		});
	});

	// Bind chip-summarize click event (fully dynamic)
	chipSummarize.addEventListener('click', async () => {
		const hasToken = localStorage.getItem('groq_copilot_key');
		
		if (!hasToken) {
			log('Error: Groq API Key is not configured. Add it in Settings.', 'error');
			tabSettings.click();
			return;
		}

		appendChatMessage('user', 'Summarize active range');
		const aiMessage = appendChatMessage('ai', 'Summarizing...', 'text');
		const aiMessageBody = aiMessage.querySelector('.message-body');

		setLoading(true);

		try {
			const docJSON = await serializeActiveContent();
			const parsed = JSON.parse(docJSON);
			log(`Summarizing active range [${parsed.mode === 'selection' ? 'Selection Only' : 'Entire Document'}]...`, 'info');

			const messages = [
				{
					role: 'system',
					content: "You are an expert executive summary agent. Analyze the provided text and document structure and return an extremely high-quality summary in 3 to 5 concise bullet points. Format the output directly as clean plain text bullet points starting with standard dash '-' prefixes. Do not return any JSON or markdown blocks."
				},
				{
					role: 'user',
					content: `Document data: ${JSON.stringify(parsed)}`
				}
			];

			const responseContent = await queryActiveLLM(messages, 0.2, false);
			activeSummaryContent = responseContent.trim();
			
			renderSummaryInMessage(aiMessageBody, activeSummaryContent);
			log('Executive summary compiled successfully by Groq AI!', 'success');
		} catch (err) {
			log(`Summarization failed: ${err.message}`, 'error');
			aiMessageBody.innerText = `Summarization failed: ${err.message}`;
		} finally {
			setLoading(false);
		}
	});

	// Real-Time Stepper Progress Component Helpers
	function updateAgentStepper(aiMessageBody, steps) {
		aiMessageBody.innerHTML = '';
		const stepperDiv = document.createElement('div');
		stepperDiv.className = 'agent-stepper';
		
		steps.forEach((step, idx) => {
			const stepItem = document.createElement('div');
			stepItem.className = `stepper-item ${step.status}`;
			
			let statusIcon = '';
			if (step.status === 'done') {
				statusIcon = '✓';
			} else if (step.status === 'running') {
				statusIcon = '<div class="stepper-spinner"></div>';
			} else if (step.status === 'failed') {
				statusIcon = '✗';
			} else {
				statusIcon = idx + 1;
			}
			
			stepItem.innerHTML = `
				<div class="stepper-icon-wrap">
					<div class="stepper-icon">${statusIcon}</div>
				</div>
				<div class="stepper-content">
					<div class="stepper-title">${step.label}</div>
					${step.details ? `<div class="stepper-details">${step.details}</div>` : ''}
				</div>
			`;
			stepperDiv.appendChild(stepItem);
		});
		
		aiMessageBody.appendChild(stepperDiv);
	}

	function setStepperStep(idx, status, details) {
		if (!currentAgentSteps || !currentAgentSteps[idx]) return;
		currentAgentSteps[idx].status = status;
		if (details !== undefined) {
			currentAgentSteps[idx].details = details;
		}
		if (activeAiMessageBody) {
			updateAgentStepper(activeAiMessageBody, currentAgentSteps);
		}
	}

	// Click run button (Refactored Intent-routed Context-aware Pipeline)
	executeBtn.addEventListener('click', async () => {
		const hasToken = localStorage.getItem('groq_copilot_key');
		const prompt = promptInput.value.trim();

		if (!hasToken) {
			log('Error: Groq API Key is not configured. Add it in Settings.', 'error');
			tabSettings.click();
			return;
		}
		if (!prompt) {
			log('Error: Prompt cannot be empty.', 'error');
			return;
		}

		// Append user message and clear input
		appendChatMessage('user', prompt);
		promptInput.value = '';

		// Append AI placeholder
		const aiMessage = appendChatMessage('ai', 'Initializing...', 'text');
		activeAiMessageBody = aiMessage.querySelector('.message-body');

		// Capture snapshot before executing
		try {
			await saveAutoCheckpoint(prompt);
		} catch(e) {
			log(`Could not capture auto-checkpoint: ${e.message}`, 'warning');
		}

		// Initialize Stepper
		currentAgentSteps = [
			{ label: "Classifying Request Intent", status: "running", details: "Contacting Router AI..." },
			{ label: "Extracting Document Context", status: "pending", details: "" },
			{ label: "Building Modification Plan", status: "pending", details: "" },
			{ label: "Applying Edits Live", status: "pending", details: "" }
		];
		updateAgentStepper(activeAiMessageBody, currentAgentSteps);

		// Initialize Telemetry Log
		lastExecutionDebugData = {
			timestamp: new Date().toLocaleString(),
			intent: "Routing...",
			serializationMode: "Determining...",
			userPrompt: prompt,
			systemPrompt: null,
			fullUserPrompt: null,
			rawResponse: null,
			parsedPlans: null,
			stateBefore: [],
			stateAfter: [],
			status: "Running (Routing Intent & Extracting Context)..."
		};
		if (typeof updateDebugViewer === 'function') updateDebugViewer();

		setLoading(true);

		try {
			// LAYER 1: Intent Router
			const intent = await routeIntent(prompt);
			lastExecutionDebugData.intent = intent;
			if (typeof updateDebugViewer === 'function') updateDebugViewer();

			setStepperStep(0, "done", `Classified as [${intent.toUpperCase()}]`);
			setStepperStep(1, "running", "Compiling document ranges...");

			// LAYER 2: Context Builder Serialization mode determination
			let serializationMode = "minimal";
			if (intent === INTENTS.FORMAT || intent === INTENTS.INSERT_CONTENT || intent === INTENTS.DELETE_CONTENT) {
				serializationMode = "medium";
			} else if (intent === INTENTS.CREATE_DOCUMENT || intent === INTENTS.RESTRUCTURE || intent === INTENTS.ANALYZE) {
				serializationMode = "full";
			}
			lastExecutionDebugData.serializationMode = serializationMode;
			if (typeof updateDebugViewer === 'function') updateDebugViewer();

			log(`[CONTEXT_BUILDER] Selected serialization mode: [${serializationMode.toUpperCase()}] for routed intent [${intent.toUpperCase()}].`, 'info');
			const docJSON = await serializeActiveContent(serializationMode);
			cachedDocData = JSON.parse(docJSON);
			
			lastExecutionDebugData.stateBefore = cachedDocData.sections || [];
			if (typeof updateDebugViewer === 'function') updateDebugViewer();

			const totalElements = cachedDocData.sections ? cachedDocData.sections.reduce((acc, s) => acc + (s.elements ? s.elements.length : 0), 0) : 0;
			const docMeta = cachedDocData.metadata || {};
			log(`[CONTEXT_BUILDER] Serialized ${totalElements} smart elements out of ${docMeta.totalElements || 0} total elements (Compaction: ${Math.round((totalElements / (docMeta.totalElements || 1)) * 100)}%). cursorIndex: ${docMeta.cursorIndex !== undefined ? docMeta.cursorIndex : 'N/A'}.`, 'success');

			if (totalElements === 0 && intent !== INTENTS.CREATE_DOCUMENT) {
				log('Error: Selection range or document is empty.', 'error');
				setStepperStep(1, "failed", "Empty selection range");
				activeAiMessageBody.innerText = 'Error: Selection range or document is empty.';
				lastExecutionDebugData.status = "Failed: Selection range or document is empty.";
				if (typeof updateDebugViewer === 'function') updateDebugViewer();
				setLoading(false);
				return;
			}

			setStepperStep(1, "done", `Compacted ${totalElements} elements`);
			
			const activeModel = localStorage.getItem('groq_copilot_model') || 'llama-3.3-70b-versatile';
			setStepperStep(2, "running", `Querying planner on model [${activeModel}]...`);

			log(`Contacting Groq API using model: ${activeModel}...`, 'info');
			lastExecutionDebugData.status = "Running (Querying LLM)...";
			if (typeof updateDebugViewer === 'function') updateDebugViewer();
			
			// LAYER 3 & 4: Planner LLM with rule injection
			const aiResponse = await queryPlannerLLM(cachedDocData, prompt, intent);
			lastExecutionDebugData.rawResponse = aiResponse;
			if (typeof updateDebugViewer === 'function') updateDebugViewer();
			
			log('Received secure Action Plan from Groq.', 'success');
			
			proposedChanges = parseAIResponse(aiResponse);
			lastExecutionDebugData.parsedPlans = proposedChanges;
			
			if (!proposedChanges || proposedChanges.length === 0) {
				log('Analysis complete: No logical changes suggested for this request.', 'warning');
				setStepperStep(2, "done", "No edits needed");
				setStepperStep(3, "done", "Finished");
				activeAiMessageBody.innerText = 'No edits needed for this request.';
				lastExecutionDebugData.status = "No changes suggested.";
			} else {
				log(`Successfully decoded ${proposedChanges.length} logical action steps.`, 'success');
				setStepperStep(2, "done", `Generated ${proposedChanges.length} actions`);
				setStepperStep(3, "running", "Executing edits sequentially...");
				lastExecutionDebugData.status = "Executing plan live on document...";
				isEditingAutonomously = true;
				log('Executing autonomous editing workflow immediately on document...', 'info');
				executeSequentialEdits(proposedChanges, activeAiMessageBody);
			}
			if (typeof updateDebugViewer === 'function') updateDebugViewer();

		} catch (err) {
			log(`Execution Error: ${err.message}`, 'error');
			// Mark running step as failed
			const runningIdx = currentAgentSteps ? currentAgentSteps.findIndex(s => s.status === 'running') : -1;
			if (runningIdx !== -1) {
				setStepperStep(runningIdx, "failed", err.message);
			}
			if (activeAiMessageBody) {
				activeAiMessageBody.innerHTML += `<div style="color: var(--error); margin-top: 8px;">Error: ${err.message}</div>`;
			}
			lastExecutionDebugData.status = "Failed: " + err.message;
			if (typeof updateDebugViewer === 'function') updateDebugViewer();
			console.error(err);
		} finally {
			setLoading(false);
		}
	});

	// Bind transaction-level Undo AI button
	undoAiBtn.addEventListener('click', () => {
		if (appliedChangesCount <= 0) return;
		undoAiBtn.disabled = true;
		log(`Undoing last AI transaction (${appliedChangesCount} operations)...`, 'info');
		
		const count = appliedChangesCount;
		appliedChangesCount = 0;
		undoAiBtn.style.display = 'none';
		undoAiBtn.disabled = false;
		
		appendChatMessage('user', 'Undo last AI action');
		const aiMessage = appendChatMessage('ai', 'Reverting document changes...', 'text');
		const aiMessageBody = aiMessage.querySelector('.message-body');
		
		performMultipleUndos(count, () => {
			log('Undo transaction complete!', 'success');
			aiMessageBody.innerHTML = '<span style="color: var(--success); font-weight: 600;">Document successfully restored to pre-AI state.</span>';
			debouncedRefresh();
		});
	});

	window.Asc.plugin.button = function(id) {
		this.executeCommand("close", "");
	};

	function setLoading(loading) {
		if (loading) {
			executeBtn.classList.add('loading');
			executeBtn.disabled = true;
		} else {
			executeBtn.classList.remove('loading');
			executeBtn.disabled = false;
		}
	}

	// Helper to extract runs with nested bold/italic/color/font properties inside any paragraph
	function serializeRuns(oElement) {
		var runsData = [];
		try {
			var aRuns = oElement.GetElements();
			if (aRuns && aRuns.length > 0) {
				for (var r = 0; r < aRuns.length; r++) {
					var oRun = aRuns[r];
					if (oRun && oRun.GetClassType() === "run") {
						var rText = oRun.GetText() || "";
						if (rText === "") continue;
						
						var rFontName = "Calibri";
						var rFontSize = 22;
						var rBold = false;
						var rItalic = false;
						var rColor = "#000000";
						
						try { if (oRun.GetFontName) rFontName = oRun.GetFontName() || rFontName; } catch(e) {}
						try { if (oRun.GetFontSize) rFontSize = oRun.GetFontSize() || rFontSize; } catch(e) {}
						try { if (oRun.GetBold) rBold = oRun.GetBold() || rBold; } catch(e) {}
						try { if (oRun.GetItalic) rItalic = oRun.GetItalic() || rItalic; } catch(e) {}
						try {
							if (oRun.GetColor) {
								var c = oRun.GetColor();
								if (c && c.GetHex) {
									var hexVal = c.GetHex();
									if (hexVal) rColor = hexVal;
								}
							}
						} catch(e) {}
						
						runsData.push({
							text: rText,
							style: {
								fontName: rFontName,
								fontSize: rFontSize / 2,
								bold: rBold,
								italic: rItalic,
								color: rColor
							}
						});
					}
				}
			}
		} catch(e) {}
		return runsData;
	}

	// ==========================================
	// ARCHITECTURAL LAYER IMPLEMENTATIONS
	// ==========================================
	// LAYER 1: Intent Router Layer
	async function routeIntent(prompt) {
		log(`Routing user intent for prompt: "${prompt.substring(0, 40)}..."`, 'info');
		const systemMessage = `You are an Intent Router. Your job is to classify the user's document editing request into exactly one of the following intents:
- "rewrite": Rewrite, rephrase, change tone, expand, shorten, professionalize text.
- "summarize": Create summary, bullets, overview of selection/document.
- "translate": Translate text into another language.
- "format": Change font, size, bold, italic, color, alignment, spacing, indentation, shading. No rewriting.
- "create_document": Generate a new document, write essays, letters, articles, full sections.
- "insert_content": Insert a new paragraph, table, or content at a location.
- "delete_content": Delete or remove paragraphs, sentences, or tables.
- "restructure": Reorganize, sort headings, change document flow or page layout/margins.
- "analyze": Analyze grammar, spelling, structure, style issues, readability.

Respond ONLY with a valid JSON object containing a single key "intent" mapped to one of the following exact string values: "rewrite", "summarize", "translate", "format", "create_document", "insert_content", "delete_content", "restructure", "analyze".
Do not include markdown packaging.
Example response: {"intent": "rewrite"}`;

		const messages = [
			{ role: 'system', content: systemMessage },
			{ role: 'user', content: `Request: "${prompt}"` }
		];

		try {
			const res = await queryActiveLLM(messages, 0.0, true);
			let clean = res.trim();
			if (clean.startsWith('```')) {
				clean = clean.replace(/^```json/, '').replace(/^```/, '').replace(/```$/, '').trim();
			}
			const parsed = JSON.parse(clean);
			if (parsed && parsed.intent && Object.values(INTENTS).includes(parsed.intent)) {
				log(`Intent classified successfully: [${parsed.intent.toUpperCase()}]`, 'success');
				return parsed.intent;
			}
		} catch (e) {
			log(`Intent routing error: ${e.message}. Defaulting to "rewrite".`, 'warning');
		}
		return INTENTS.REWRITE;
	}

	// LAYER 3 & 4: Planner LLM Layer with Rule Injection
	async function queryPlannerLLM(docData, prompt, intent) {
		const ruleset = RULES[intent] || RULES.rewrite;
		const systemMessage = `You are a professional document planner assistant. Your job is to analyze the provided document context and user request, and generate a high-level logical Action Plan.

You must NEVER generate OnlyOffice API commands directly (like Select(), AddElement(), etc.).
You must ONLY output valid JSON containing a single "plans" key holding an array of high-level action objects.

CRITICAL CARET/CURSOR ANCHORING RULES:
1. If the user request asks to add, insert, generate, or create content (such as paragraphs, headings, lists, or tables) and a valid "cursorIndex" (>= 0) is specified in the document metadata under "metadata.cursorIndex", you MUST default to inserting/creating the content directly at or after the "cursorIndex" (i.e., targetIndex = cursorIndex).
2. If the user explicitly asks to put content "where the mouse is", "where the cursor is", "under the cursor", "at the cursor", "at my selection", or similar, you MUST target the "cursorIndex" for the insertion action.
3. Only override this behavior if the user specifies an explicit alternative location (e.g., "in last of the document" or "at the very beginning").

Every plan action must follow this exact structure:
{
  "plans": [
    {
      "action": "rewrite" | "change_font" | "change_color" | "create_paragraph" | "delete_paragraph" | "paste_html" | "make_list" | "change_indent" | "table_action",
      "targetIndex": 5, // index of target paragraph or table
      "subAction": "create" | "add_row" | "add_column" | "delete_row" | "delete_column" | "merge_cells" | "cell_shading" | "set_cell_text", // ONLY for "table_action"
      "properties": {
        "newText": "Rewritten or newly created plain text here...",
        "html": "<p style='font-family:Arial;font-size:12pt;'>Styled HTML content for paste_html...</p>",
        "fontName": "Georgia",
        "fontSize": 12, // in standard points (e.g., 12 for 12pt)
        "bold": true,
        "italic": false,
        "underline": true,
        "strikeout": false,
        "doubleStrikeout": false,
        "color": "#1e40af",
        "highlight": "yellow",
        "alignment": "justify" | "left" | "center" | "right",
        "spacingBefore": 120, // in dxa
        "spacingAfter": 120, // in dxa
        "lineSpacing": 1.15,
        "shading": "#f3f4f6",
        
        // List styling properties (applicable for make_list AND create_paragraph):
        "listType": "bullet" | "numbered",
        "style": "bullet" | "decimal" | "lowerRoman" | "upperRoman" | "lowerLetter" | "upperLetter",
        "level": 0, // nesting level 0 to 8
        "formatString": "•" | "%1." | "%1)" | "%1.%2.",
        
        // Indentation properties (applicable for change_indent AND create_paragraph):
        "indLeft": 720, // in dxa/twips (1440 = 1 inch, 720 = 0.5 inch)
        "indRight": 720,
        "indFirstLine": 360,
        
        // Table properties (ONLY for table_action):
        "rows": 3, // for subAction 'create'
        "cols": 3, // for subAction 'create'
        "rowIndex": 0, // for add_row or delete_row
        "colIndex": 0, // for delete_column
        "before": true, // for add_row
        "cells": [[0, 0], [0, 1]], // coordinates [row, col] for merge_cells, cell_shading, or set_cell_text
        "color": "#eff6ff", // shading color for cell_shading
        "cellData": [["header1", "header2"], ["val1", "val2"]] // 2D array of strings to populate table cells directly on subAction 'create'
      }
    }
  ]
}

Specific rules for this intent [${intent.toUpperCase()}]:
${ruleset.instructions}

Return valid JSON only. Do not include markdown code block formatting (like \`\`\`json).`;

		const userMessage = `Current Document Context (${docData.targetMode} mode):
${JSON.stringify(docData, null, 2)}

User Request:
"${prompt}"`;

		const messages = [
			{ role: 'system', content: systemMessage },
			{ role: 'user', content: userMessage }
		];

		lastExecutionDebugData.systemPrompt = systemMessage;
		lastExecutionDebugData.fullUserPrompt = userMessage;
		if (typeof updateDebugViewer === 'function') updateDebugViewer();

		return await queryActiveLLM(messages, 0.1, true);
	}

	// LAYER 6: Verification Engine helpers
	function captureElementState(targetIndex) {
		return new Promise((resolve) => {
			window.Asc.scope.targetIndex = targetIndex;
			window.Asc.plugin.callCommand(function() {
				var targetIndex = Asc.scope.targetIndex;
				var oDocument = Api.GetDocument();
				var count = oDocument.GetElementsCount();
				if (targetIndex >= count || targetIndex < 0) {
					return null;
				}
				var oParagraph = oDocument.GetElement(targetIndex);
				if (!oParagraph || oParagraph.GetClassType() !== "paragraph") {
					return { type: "other", text: "", elementsCount: count };
				}
				var text = oParagraph.GetText() || "";
				var fontName = "Calibri";
				var fontSize = 22;
				var bold = false;
				var underline = false;
				
				try {
					var runCount = oParagraph.GetElementsCount();
					if (runCount > 0) {
						var firstRun = oParagraph.GetElement(0);
						if (firstRun) {
							// 1. Direct from Run properties
							try {
								if (typeof firstRun.GetFontFamily === "function") {
									var family = firstRun.GetFontFamily();
									if (family) fontName = family;
								}
							} catch(e) {}
							try {
								if ((fontName === "Calibri" || !fontName) && typeof firstRun.GetFontNames === "function") {
									var names = firstRun.GetFontNames();
									if (names && names.length > 0) fontName = names[0] || fontName;
								}
							} catch(e) {}
							try {
								if ((fontName === "Calibri" || !fontName) && typeof firstRun.GetFontName === "function") {
									fontName = firstRun.GetFontName() || fontName;
								}
							} catch(e) {}
							try { if (typeof firstRun.GetFontSize === "function") fontSize = firstRun.GetFontSize() || fontSize; } catch(e) {}
							try { if (typeof firstRun.GetBold === "function") bold = !!firstRun.GetBold(); } catch(e) {}
							try { if (typeof firstRun.GetUnderline === "function") underline = !!firstRun.GetUnderline(); } catch(e) {}

							// 2. From Text properties (TextPr)
							try {
								if (typeof firstRun.GetTextPr === "function") {
									var tp = firstRun.GetTextPr();
									if (tp) {
										if (fontName === "Calibri" && typeof tp.GetFontFamily === "function") fontName = tp.GetFontFamily() || fontName;
										if (!fontSize && typeof tp.GetFontSize === "function") fontSize = tp.GetFontSize() || fontSize;
										if (!bold && typeof tp.GetBold === "function") bold = !!tp.GetBold();
										if (!underline && typeof tp.GetUnderline === "function") underline = !!tp.GetUnderline();
									}
								}
							} catch(e) {}
						}
					}
				} catch(e) {}

				return {
					type: "paragraph",
					text: text,
					fontName: fontName,
					fontSize: fontSize / 2, // convert to standard points
					bold: bold,
					underline: underline,
					elementsCount: count
				};
			}, false, true, function(res) {
				resolve(res);
			});
		});
	}

	function verifyChange(change, beforeState, afterState) {
		const actionName = change.action;
		const props = change.properties || {};

		if (actionName === 'delete_paragraph' || actionName === 'deleteParagraph') {
			if (!beforeState) return { success: true }; 
			if (!afterState) return { success: true }; 
			if (afterState.elementsCount < beforeState.elementsCount) {
				return { success: true };
			}
			return { success: false, reason: "Paragraph count did not decrease after deletion" };
		}

		if (actionName === 'create_paragraph' || actionName === 'createParagraph') {
			if (afterState && afterState.elementsCount > (beforeState ? beforeState.elementsCount : 0)) {
				return { success: true };
			}
			return { success: false, reason: "Paragraph count did not increase after creation" };
		}

		if (actionName === 'paste_html' || actionName === 'pasteHTML') {
			if (afterState && (afterState.text !== (beforeState ? beforeState.text : "") || afterState.elementsCount > (beforeState ? beforeState.elementsCount : 0))) {
				return { success: true };
			}
			return { success: false, reason: "No new content detected after HTML paste" };
		}

		if (actionName === 'make_list' || actionName === 'makeList' ||
		    actionName === 'change_indent' || actionName === 'changeIndent' ||
		    actionName === 'table_action' || actionName === 'tableAction') {
			return { success: true };
		}

		if (afterState) {
			if (props.newText !== undefined && afterState.text !== props.newText) {
				const cleanAfter = afterState.text.replace(/[\s\r\n\t]+/g, '');
				const cleanExpected = props.newText.replace(/(<([^>]+)>)/gi, "").replace(/[\s\r\n\t]+/g, ''); 
				if (cleanAfter.indexOf(cleanExpected) === -1 && cleanExpected.indexOf(cleanAfter) === -1) {
					return { success: false, reason: `Text mismatch. Expected: "${props.newText.substring(0, 20)}...", Got: "${afterState.text.substring(0, 20)}..."` };
				}
			}
			// Only verify styling if the paragraph has text content
			if (afterState.text && afterState.text.trim() !== "") {
				if (props.fontName !== undefined && afterState.fontName !== props.fontName) {
					const cleanExpected = props.fontName.toLowerCase().replace(/['"\s]+/g, '');
					const cleanAfter = afterState.fontName.toLowerCase().replace(/['"\s]+/g, '');
					if (cleanAfter !== cleanExpected) {
						// Lenient fallback check: custom/niche fonts might not be installed/rendered locally by the editor engine.
						// If font name was set but defaulted to system Calibri/Times, and size or bold or underline did change successfully,
						// we treat it as successfully executed rather than looping retries endlessly.
						const sizeMatches = props.fontSize === undefined || afterState.fontSize === (props.fontSize / 2);
						const boldMatches = props.bold === undefined || afterState.bold === !!props.bold;
						const underlineMatches = props.underline === undefined || afterState.underline === !!props.underline;
						
						const sizeChanged = beforeState && beforeState.fontSize !== afterState.fontSize;
						const boldChanged = beforeState && beforeState.bold !== afterState.bold;
						const underlineChanged = beforeState && beforeState.underline !== afterState.underline;
						
						if ((props.fontSize && sizeMatches && sizeChanged) || 
							(props.bold !== undefined && boldMatches && boldChanged) || 
							(props.underline !== undefined && underlineMatches && underlineChanged)) {
							// Lenient bypass: other styles successfully applied to this element!
						} else {
							return { success: false, reason: `Font Family mismatch. Expected: "${props.fontName}", Got: "${afterState.fontName}"` };
						}
					}
				}
				if (props.fontSize !== undefined && afterState.fontSize !== (props.fontSize / 2)) {
					return { success: false, reason: `Font Size mismatch. Expected: ${props.fontSize / 2}pt, Got: ${afterState.fontSize}pt` };
				}
				if (props.bold !== undefined && afterState.bold !== !!props.bold) {
					return { success: false, reason: `Font Weight (Bold) mismatch. Expected: ${!!props.bold}, Got: ${afterState.bold}` };
				}
				if (props.underline !== undefined && afterState.underline !== !!props.underline) {
					return { success: false, reason: `Underline mismatch. Expected: ${!!props.underline}, Got: ${afterState.underline}` };
				}
			}
			return { success: true };
		}

		return { success: false, reason: "Unable to capture post-execution element state" };
	}

	// LAYER 2: Dynamic Intent-Routed Selection Serializer
	function serializeActiveContent(mode = "minimal") {
		return new Promise((resolve, reject) => {
			const failTimeout = setTimeout(() => {
				reject(new Error("Content scanning timed out. ONLYOFFICE sandbox did not respond."));
			}, 5000);

			window.Asc.scope.mode = mode;

			window.Asc.plugin.callCommand(function() {
				var targetMode = Asc.scope.mode || "minimal";
				// Helper to extract styling from character run with full hierarchy inheritance
				function extractRunStyle(oRun, oElement) {
					var rFontName = "";
					var rFontSize = 0;
					var rBold = null;
					var rItalic = null;
					var rUnderline = null;
					var rStrikeout = null;
					var rColor = "";
					var rHighlight = null;
					var rShd = null;
					var rSmallCaps = null;
					var rCaps = null;
					var rSubscript = null;
					var rSuperscript = null;
					var rSpacing = 0;
					var rDoubleStrikeout = null;

					// 1. Direct from Run properties
					try {
						if (oRun.GetFontNames) {
							var names = oRun.GetFontNames();
							if (names && names.length > 0) rFontName = names[0] || "";
						}
					} catch(e) {}
					try { if (!rFontName && oRun.GetFontName) rFontName = oRun.GetFontName() || ""; } catch(e) {}
					try { if (oRun.GetFontSize) rFontSize = oRun.GetFontSize() || 0; } catch(e) {}
					try { if (oRun.GetBold) rBold = oRun.GetBold(); } catch(e) {}
					try { if (oRun.GetItalic) rItalic = oRun.GetItalic(); } catch(e) {}
					try { if (oRun.GetUnderline) rUnderline = !!oRun.GetUnderline(); } catch(e) {}
					try { if (oRun.GetStrikeout) rStrikeout = !!oRun.GetStrikeout(); } catch(e) {}
					try { if (oRun.GetSmallCaps) rSmallCaps = !!oRun.GetSmallCaps(); } catch(e) {}
					try { if (oRun.GetCaps) rCaps = !!oRun.GetCaps(); } catch(e) {}
					try { if (oRun.GetSubscript) rSubscript = !!oRun.GetSubscript(); } catch(e) {}
					try { if (oRun.GetSuperscript) rSuperscript = !!oRun.GetSuperscript(); } catch(e) {}
					try { if (oRun.GetSpacing) rSpacing = oRun.GetSpacing() || 0; } catch(e) {}
					try { if (oRun.GetDoubleStrikeout) rDoubleStrikeout = !!oRun.GetDoubleStrikeout(); } catch(e) {}
					try {
						if (oRun.GetColor) {
							var c = oRun.GetColor();
							if (c && c.GetHex) rColor = c.GetHex() || "";
						}
					} catch(e) {}

					// 2. From Text properties (TextPr)
					try {
						if (oRun.GetTextPr) {
							var tp = oRun.GetTextPr();
							if (tp) {
								if (!rFontName && tp.GetFontFamily) rFontName = tp.GetFontFamily() || "";
								if (!rFontSize && tp.GetFontSize) rFontSize = tp.GetFontSize() || 0;
								if (rBold === null && tp.GetBold) rBold = tp.GetBold();
								if (rItalic === null && tp.GetItalic) rItalic = tp.GetItalic();
								if (rUnderline === null && tp.GetUnderline) rUnderline = !!tp.GetUnderline();
								if (rStrikeout === null && tp.GetStrikeout) rStrikeout = !!tp.GetStrikeout();
								if (rSmallCaps === null && tp.GetSmallCaps) rSmallCaps = !!tp.GetSmallCaps();
								if (rCaps === null && tp.GetCaps) rCaps = !!tp.GetCaps();
								if (rSubscript === null && tp.GetSubscript) rSubscript = !!tp.GetSubscript();
								if (rSuperscript === null && tp.GetSuperscript) rSuperscript = !!tp.GetSuperscript();
								if (rSpacing === 0 && tp.GetSpacing) rSpacing = tp.GetSpacing() || 0;
								if (rDoubleStrikeout === null && tp.GetDoubleStrikeout) rDoubleStrikeout = !!tp.GetDoubleStrikeout();
								if (!rColor && tp.GetColor) {
									var c = tp.GetColor();
									if (c && c.GetHex) rColor = c.GetHex() || "";
								}
								if (tp.GetHighlight) {
									var hl = tp.GetHighlight();
									if (hl) {
										if (typeof hl === "string") rHighlight = hl;
										else if (hl.GetHex) rHighlight = hl.GetHex() || null;
									}
								}
								if (tp.GetShd) {
									var sd = tp.GetShd();
									if (sd) {
										if (typeof sd === "string") rShd = sd;
										else if (sd.GetHex) rShd = sd.GetHex() || null;
									}
								}
							}
						}
					} catch(e) {}

					// 3. Fallback to Paragraph Properties Style inheritance
					try {
						if (oElement && oElement.GetParaPr) {
							var pPr = oElement.GetParaPr();
							if (pPr && pPr.GetStyle) {
								var style = pPr.GetStyle();
								if (style && style.GetTextPr) {
									var stp = style.GetTextPr();
									if (stp) {
										if (!rFontName && stp.GetFontFamily) rFontName = stp.GetFontFamily() || "";
										if (!rFontSize && stp.GetFontSize) rFontSize = stp.GetFontSize() || 0;
										if (rBold === null && stp.GetBold) rBold = stp.GetBold();
										if (rItalic === null && stp.GetItalic) rItalic = stp.GetItalic();
										if (rUnderline === null && stp.GetUnderline) rUnderline = !!stp.GetUnderline();
										if (rStrikeout === null && stp.GetStrikeout) rStrikeout = !!stp.GetStrikeout();
										if (rSmallCaps === null && stp.GetSmallCaps) rSmallCaps = !!stp.GetSmallCaps();
										if (rCaps === null && stp.GetCaps) rCaps = !!stp.GetCaps();
										if (rSubscript === null && stp.GetSubscript) rSubscript = !!stp.GetSubscript();
										if (rSuperscript === null && stp.GetSuperscript) rSuperscript = !!stp.GetSuperscript();
										if (rSpacing === 0 && stp.GetSpacing) rSpacing = stp.GetSpacing() || 0;
										if (rDoubleStrikeout === null && stp.GetDoubleStrikeout) rDoubleStrikeout = !!stp.GetDoubleStrikeout();
										if (!rColor && stp.GetColor) {
											var c = stp.GetColor();
											if (c && c.GetHex) rColor = c.GetHex() || "";
										}
										if (!rHighlight && stp.GetHighlight) {
											var hl = stp.GetHighlight();
											if (hl) {
												if (typeof hl === "string") rHighlight = hl;
												else if (hl.GetHex) rHighlight = hl.GetHex() || null;
											}
										}
										if (!rShd && stp.GetShd) {
											var sd = stp.GetShd();
											if (sd) {
												if (typeof sd === "string") rShd = sd;
												else if (sd.GetHex) rShd = sd.GetHex() || null;
											}
										}
									}
								}
							}
						}
					} catch(e) {}

					// 4. Default fallbacks if still missing
					if (!rFontName) rFontName = "Calibri";
					if (!rFontSize) rFontSize = 22; // 11pt
					if (rBold === null) rBold = false;
					if (rItalic === null) rItalic = false;
					if (rUnderline === null) rUnderline = false;
					if (rStrikeout === null) rStrikeout = false;
					if (rSmallCaps === null) rSmallCaps = false;
					if (rCaps === null) rCaps = false;
					if (rSubscript === null) rSubscript = false;
					if (rSuperscript === null) rSuperscript = false;
					if (rDoubleStrikeout === null) rDoubleStrikeout = false;
					if (!rColor) rColor = "#000000";

					return {
						fontName: rFontName,
						fontSize: rFontSize / 2,
						bold: !!rBold,
						italic: !!rItalic,
						underline: !!rUnderline,
						strikeout: !!rStrikeout,
						smallCaps: !!rSmallCaps,
						caps: !!rCaps,
						subscript: !!rSubscript,
						superscript: !!rSuperscript,
						characterSpacing: rSpacing,
						doubleStrikeout: !!rDoubleStrikeout,
						color: rColor,
						highlight: rHighlight,
						shading: rShd
					};
				}

				// Helper to extract styling and layout from paragraph
				function extractParagraphStyle(selPara) {
					var oFontName = "Calibri";
					var oFontSize = 22;
					var oBold = false;
					var oItalic = false;
					var oUnderline = false;
					var oStrikeout = false;
					var oColor = "#000000";
					var oAlign = "left";
					var oSpaceBefore = 0;
					var oSpaceAfter = 0;
					var oLineSpacing = 1.0;
					var oLineSpacingRule = "auto";
					var oLineSpacingTwips = 0;
					var oShd = null;
					var listType = null;
					var oIndLeft = 0;
					var oIndRight = 0;
					var oIndFirstLine = 0;
					var oStyleName = null;

					// 1. Get properties from first run of paragraph
					try {
						var count = selPara.GetElementsCount();
						if (count > 0) {
							var firstRun = selPara.GetElement(0);
							if (firstRun && firstRun.GetClassType() === "run") {
								var runStyle = extractRunStyle(firstRun, selPara);
								oFontName = runStyle.fontName;
								oFontSize = runStyle.fontSize * 2;
								oBold = runStyle.bold;
								oItalic = runStyle.italic;
								oUnderline = runStyle.underline;
								oStrikeout = runStyle.strikeout;
								oColor = runStyle.color;
							}
						}
					} catch(e) {}

					// 2. Access ParaPr layout/spacing properties
					try {
						if (selPara.GetParaPr) {
							var pPr = selPara.GetParaPr();
							if (pPr) {
								if (pPr.GetJc) {
									var jc = pPr.GetJc();
									if (jc === "both" || jc === "justify") oAlign = "justify";
									else if (jc) oAlign = jc;
								}
								if (pPr.GetSpacingBefore) oSpaceBefore = pPr.GetSpacingBefore() || 0;
								if (pPr.GetSpacingAfter) oSpaceAfter = pPr.GetSpacingAfter() || 0;
								if (pPr.GetSpacingLineValue) oLineSpacingTwips = pPr.GetSpacingLineValue() || 0;
								if (pPr.GetSpacingLineRule) oLineSpacingRule = pPr.GetSpacingLineRule() || "auto";
								
								// Calculate line spacing multiplier
								if (oLineSpacingRule === "auto" && oLineSpacingTwips > 0) {
									oLineSpacing = Math.round((oLineSpacingTwips / 240) * 100) / 100;
								} else if (oLineSpacingTwips > 0) {
									oLineSpacing = Math.round((oLineSpacingTwips / 20) * 100) / 100; // in points
								}

								if (pPr.GetShd) {
									var sd = pPr.GetShd();
									if (sd) {
										if (typeof sd === "string") oShd = sd;
										else if (sd.GetHex) oShd = sd.GetHex() || null;
									}
								}
								
								if (pPr.GetIndLeft) oIndLeft = pPr.GetIndLeft() || 0;
								if (pPr.GetIndRight) oIndRight = pPr.GetIndRight() || 0;
								if (pPr.GetIndFirstLine) oIndFirstLine = pPr.GetIndFirstLine() || 0;
								
								if (pPr.GetStyle) {
									var style = pPr.GetStyle();
									if (style && style.GetName) oStyleName = style.GetName();
								}
							}
						}
					} catch(e) {}

					// 3. Detect Numbering/Bullet properties
					try {
						if (selPara.GetNumbering) {
							var num = selPara.GetNumbering();
							if (num) {
								listType = "numbered";
								if (num.GetNumFormat) {
									var fmt = num.GetNumFormat();
									if (fmt === "bullet") {
										listType = "bullet";
									}
								}
							}
						}
					} catch(e) {}

					return {
						fontName: oFontName,
						fontSize: oFontSize / 2,
						bold: oBold,
						italic: oItalic,
						underline: oUnderline,
						strikeout: oStrikeout,
						alignment: oAlign,
						color: oColor,
						spacingBefore: oSpaceBefore,
						spacingAfter: oSpaceAfter,
						lineSpacing: oLineSpacing,
						lineSpacingRule: oLineSpacingRule,
						lineSpacingTwips: oLineSpacingTwips,
						shading: oShd,
						listType: listType,
						indLeft: oIndLeft,
						indRight: oIndRight,
						indFirstLine: oIndFirstLine,
						styleName: oStyleName
					};
				}

				// Helper to omit default styles and duplicates (Delta compression)
				function compressParagraphStyle(style) {
					var compressed = {};
					var defaults = {
						fontName: "Calibri",
						fontSize: 11,
						bold: false,
						italic: false,
						underline: false,
						strikeout: false,
						alignment: "left",
						color: "#000000",
						spacingBefore: 0,
						spacingAfter: 0,
						lineSpacing: 1.0,
						lineSpacingRule: "auto",
						lineSpacingTwips: 0,
						shading: null,
						listType: null,
						indLeft: 0,
						indRight: 0,
						indFirstLine: 0,
						styleName: null
					};
					
					for (var key in style) {
						if (style.hasOwnProperty(key)) {
							var val = style[key];
							var def = defaults[key];
							if (val !== def) {
								if (def === null && !val) continue;
								compressed[key] = val;
							}
						}
					}
					return compressed;
				}

				// Helper to filter run styles that match the paragraph's resolved layout style
				function compressRunStyle(runStyle, paraStyle) {
					var compressed = {};
					if (runStyle.fontName !== paraStyle.fontName) compressed.fontName = runStyle.fontName;
					if (runStyle.fontSize !== paraStyle.fontSize) compressed.fontSize = runStyle.fontSize;
					if (runStyle.bold !== paraStyle.bold) compressed.bold = runStyle.bold;
					if (runStyle.italic !== paraStyle.italic) compressed.italic = runStyle.italic;
					if (runStyle.underline !== paraStyle.underline) compressed.underline = runStyle.underline;
					if (runStyle.strikeout !== paraStyle.strikeout) compressed.strikeout = runStyle.strikeout;
					if (runStyle.doubleStrikeout !== paraStyle.doubleStrikeout) compressed.doubleStrikeout = runStyle.doubleStrikeout;
					if (runStyle.smallCaps !== paraStyle.smallCaps) compressed.smallCaps = runStyle.smallCaps;
					if (runStyle.caps !== paraStyle.caps) compressed.caps = runStyle.caps;
					if (runStyle.subscript !== paraStyle.subscript) compressed.subscript = runStyle.subscript;
					if (runStyle.superscript !== paraStyle.superscript) compressed.superscript = runStyle.superscript;
					if (runStyle.characterSpacing !== paraStyle.characterSpacing && runStyle.characterSpacing !== 0) compressed.characterSpacing = runStyle.characterSpacing;
					if (runStyle.color !== paraStyle.color && runStyle.color !== "#000000") compressed.color = runStyle.color;
					if (runStyle.highlight && runStyle.highlight !== "none") compressed.highlight = runStyle.highlight;
					if (runStyle.shading) compressed.shading = runStyle.shading;

					for (var key in compressed) {
						if (compressed.hasOwnProperty(key)) {
							return compressed;
						}
					}
					return null;
				}

				// Define serializeRunsInside using rich style extraction & delta compression
				function serializeRunsInside(oElement, paraStyle) {
					var runsData = [];
					try {
						var count = oElement.GetElementsCount();
						for (var r = 0; r < count; r++) {
							var oRun = oElement.GetElement(r);
							if (oRun && oRun.GetClassType() === "run") {
								var rText = oRun.GetText() || "";
								if (rText === "") continue;
								
								var runStyle = extractRunStyle(oRun, oElement);
								var compressed = compressRunStyle(runStyle, paraStyle);
								
								var runObj = { text: rText };
								if (compressed) {
									runObj.style = compressed;
								}
								runsData.push(runObj);
							}
						}
					} catch(e) {}
					return runsData;
				}

				var oDocument = Api.GetDocument();
				var oRange = null;
				try {
					oRange = oDocument.GetRangeBySelect();
				} catch(e) {}
				
				// Determine if we have a valid selection containing actual text
				var isSelection = false;
				var selectedParagraphs = [];
				var selectedLines = [];
				if (oRange) {
					var rText = oRange.GetText() || "";
					var cleanText = rText.replace(/[\r\n\s\t]+/g, "");
					if (cleanText.length > 0) {
						isSelection = true;
						try {
							selectedParagraphs = oRange.GetAllParagraphs();
							selectedLines = rText.split(/\r\n|\r|\n/);
						} catch(e) {}
					}
				}
				
				var sections = [];
				var precedingContext = [];
				var succeedingContext = [];
				var documentHeadings = [];
				var pageSettings = null;
				var elementsCount = oDocument.GetElementsCount();
				
				var cursorIndex = -1;
				if (oRange) {
					try {
						var caretParagraphs = oRange.GetAllParagraphs();
						if (caretParagraphs && caretParagraphs.length > 0) {
							var caretPara = caretParagraphs[0];
							for (var j = 0; j < elementsCount; j++) {
								var docElem = oDocument.GetElement(j);
								if (docElem === caretPara) {
									cursorIndex = j;
									break;
								}
							}
						}
					} catch(e) {}
				}

				if (targetMode === "full") {
					// Compile global document outline map & section styles beforehand
					for (var h = 0; h < elementsCount; h++) {
						try {
							var oElem = oDocument.GetElement(h);
							if (oElem && oElem.GetClassType() === "paragraph") {
								var oText = oElem.GetText() || "";
								var paraStyle = extractParagraphStyle(oElem);
								var cleanText = oText.trim().replace(/[\r\n\t]+/g, '');
								var isHeading = false;
								
								if (paraStyle.styleName && paraStyle.styleName.toLowerCase().indexOf("heading") !== -1) {
									isHeading = true;
								} else if ((paraStyle.fontSize * 2 >= 28 || (paraStyle.bold && paraStyle.fontSize * 2 >= 24)) && cleanText.length > 0 && cleanText.length < 150) {
									isHeading = true;
								} else if (cleanText.length > 3 && cleanText.length < 80 && cleanText === cleanText.toUpperCase() && !/^\d+$/.test(cleanText)) {
									isHeading = true;
								} else if (/^(Chapter\s+\d+|\d+(\.\d+)*\s+[A-Za-z])/i.test(cleanText) && cleanText.length < 100) {
									isHeading = true;
								}
								
								if (isHeading) {
									documentHeadings.push({
										index: h,
										text: oText,
										styleName: paraStyle.styleName || ("Heading (Size " + paraStyle.fontSize + "pt)")
									});
								}
							}
						} catch(eOutline) {}
					}

					try {
						var firstSection = null;
						if (typeof oDocument.GetSections === "function") {
							var secs = oDocument.GetSections();
							if (secs && secs.length > 0) firstSection = secs[0];
						} else if (typeof oDocument.GetSection === "function") {
							firstSection = oDocument.GetSection(0);
						}
						if (firstSection) {
							pageSettings = {};
							try { if (firstSection.GetPageWidth) pageSettings.pageWidth = firstSection.GetPageWidth(); } catch(e) {}
							try { if (firstSection.GetPageHeight) pageSettings.pageHeight = firstSection.GetPageHeight(); } catch(e) {}
							try { if (firstSection.GetPageOrientation) pageSettings.pageOrientation = firstSection.GetPageOrientation(); } catch(e) {}
							try { if (firstSection.GetMarginLeft) pageSettings.marginLeft = firstSection.GetMarginLeft(); } catch(e) {}
							try { if (firstSection.GetMarginRight) pageSettings.marginRight = firstSection.GetMarginRight(); } catch(e) {}
							try { if (firstSection.GetMarginTop) pageSettings.marginTop = firstSection.GetMarginTop(); } catch(e) {}
							try { if (firstSection.GetMarginBottom) pageSettings.marginBottom = firstSection.GetMarginBottom(); } catch(e) {}
						}
					} catch(ePage) {}
				}
				
				if (isSelection && selectedParagraphs.length > 0) {
					// --- SELECTION ONLY MODE (serialize only the highlighted range) ---
					var elements = [];
					var firstAbsIndex = -1;
					var lastAbsIndex = -1;
					
					// Pre-fetch all elements once to speed up lookup from O(N*M) to O(N)
					var allDocElements = [];
					for (var j = 0; j < elementsCount; j++) {
						allDocElements.push(oDocument.GetElement(j));
					}
					
					for (var i = 0; i < selectedParagraphs.length; i++) {
						var selPara = selectedParagraphs[i];
						if (!selPara) continue;
						
						// Find the absolute document element index
						var absoluteIndex = -1;
						for (var j = 0; j < allDocElements.length; j++) {
							var docElem = allDocElements[j];
							if (docElem && docElem.GetClassType() === "paragraph") {
								if (docElem === selPara) {
									absoluteIndex = j;
									break;
								}
							}
						}
						
						// Fallback check by text similarity if direct reference comparison fails
						if (absoluteIndex === -1) {
							var selText = selPara.GetText() || "";
							for (var j = 0; j < allDocElements.length; j++) {
								var docElem = allDocElements[j];
								if (docElem && docElem.GetClassType() === "paragraph" && docElem.GetText() === selText) {
									absoluteIndex = j;
									break;
								}
							}
						}
						
						if (absoluteIndex === -1) {
							absoluteIndex = i;
						}

						if (firstAbsIndex === -1) {
							firstAbsIndex = absoluteIndex;
						}
						lastAbsIndex = absoluteIndex;
						
						var fullParaText = selPara.GetText() || "";
						var selectedText = selectedLines[i] || "";
						var startIndex = fullParaText.indexOf(selectedText);
						if (startIndex === -1) startIndex = 0;
						
						// Get paragraph style details first for run style delta-compression
						var paraStyle = (targetMode !== "minimal") ? extractParagraphStyle(selPara) : null;
						var runsData = [];
						
						if (targetMode === "full") {
							var currentOffset = 0;
							try {
								var runCount = selPara.GetElementsCount();
								for (var r = 0; r < runCount; r++) {
									var oRun = selPara.GetElement(r);
									if (oRun && oRun.GetClassType() === "run") {
										var rText = oRun.GetText() || "";
										var runStart = currentOffset;
										var runEnd = currentOffset + rText.length;
										currentOffset = runEnd;
										
										var selStart = startIndex;
										var selEnd = startIndex + selectedText.length;
										
										// Compute intersection of the selection with the run
										var intersectStart = Math.max(runStart, selStart);
										var intersectEnd = Math.min(runEnd, selEnd);
										
										if (intersectStart < intersectEnd) {
											var slicedText = rText.substring(intersectStart - runStart, intersectEnd - runStart);
											if (slicedText.length > 0) {
												var runStyle = extractRunStyle(oRun, selPara);
												var compressed = compressRunStyle(runStyle, paraStyle);
												var runObj = { text: slicedText };
												if (compressed) {
													runObj.style = compressed;
												}
												runsData.push(runObj);
											}
										}
									}
								}
							} catch(errRuns) {}
							
							// If runs extraction intersects empty or misses, fall back to first run style or paragraph defaults
							if (runsData.length === 0 && selectedText.length > 0) {
								var compressed = compressRunStyle({
									fontName: paraStyle.fontName,
									fontSize: paraStyle.fontSize,
									bold: paraStyle.bold,
									italic: paraStyle.italic,
									underline: paraStyle.underline,
									strikeout: paraStyle.strikeout,
									doubleStrikeout: paraStyle.doubleStrikeout,
									smallCaps: paraStyle.smallCaps,
									caps: paraStyle.caps,
									subscript: paraStyle.subscript,
									superscript: paraStyle.superscript,
									characterSpacing: paraStyle.characterSpacing,
									color: paraStyle.color,
									highlight: null,
									shading: paraStyle.shading
								}, paraStyle);
								
								var runObj = { text: selectedText };
								if (compressed) {
									runObj.style = compressed;
								}
								runsData.push(runObj);
							}
						}
						
						var elementJSON = {
							type: "paragraph",
							index: absoluteIndex,
							text: selectedText
						};
						
						if (targetMode !== "minimal" && paraStyle) {
							elementJSON.style = compressParagraphStyle(paraStyle);
						}
						
						if (targetMode === "full" && runsData.length > 0) {
							// Determine if the runs data contains no styling overrides (homogeneous paragraph check)
							var isHomogeneous = true;
							for (var k = 0; k < runsData.length; k++) {
								if (runsData[k].style) {
									isHomogeneous = false;
									break;
								}
							}
							if (!isHomogeneous) {
								elementJSON.runs = runsData;
							}
						}
						
						elements.push(elementJSON);
					}

					// Fetch Preceding and Succeeding Context paragraphs to make the Copilot fully aware of surroundings!
					if (targetMode === "full" && firstAbsIndex > 0) {
						var startPre = Math.max(0, firstAbsIndex - 4);
						for (var p = startPre; p < firstAbsIndex; p++) {
							try {
								var oElem = oDocument.GetElement(p);
								if (oElem && oElem.GetClassType() === "paragraph") {
									precedingContext.push({
										index: p,
										text: oElem.GetText() || "",
										style: compressParagraphStyle(extractParagraphStyle(oElem))
									});
								}
							} catch(ePre) {}
						}
					}
					
					if (targetMode === "full" && lastAbsIndex >= 0 && lastAbsIndex < elementsCount - 1) {
						var endSuf = Math.min(elementsCount, lastAbsIndex + 5);
						for (var p = lastAbsIndex + 1; p < endSuf; p++) {
							try {
								var oElem = oDocument.GetElement(p);
								if (oElem && oElem.GetClassType() === "paragraph") {
									succeedingContext.push({
										index: p,
										text: oElem.GetText() || "",
										style: compressParagraphStyle(extractParagraphStyle(oElem))
									});
								}
							} catch(eSuf) {}
						}
					}
					
					sections.push({
						title: "Active Selection Range",
						elements: elements
					});
					
				} else {
					// --- ENTIRE DOCUMENT MODE (Root Section fallback with Caret-Anchored sliding window) ---
					var currentSection = {
						title: "Root Section",
						elements: []
					};
					
					var indicesToSerialize = [];
					var maxWholeDocLimit = 45; // max elements to serialize in entire doc mode to prevent TPM limit errors
					
					if (elementsCount <= maxWholeDocLimit) {
						for (var i = 0; i < elementsCount; i++) {
							indicesToSerialize.push(i);
						}
					} else {
						var indexSet = {};
						
						// 1. First 15 paragraphs (Intro)
						var firstLimit = Math.min(15, elementsCount);
						for (var i = 0; i < firstLimit; i++) {
							indexSet[i] = true;
						}
						
						// 2. Last 15 paragraphs (Outro)
						var lastStart = Math.max(0, elementsCount - 15);
						for (var i = lastStart; i < elementsCount; i++) {
							indexSet[i] = true;
						}
						
						// 3. Cursor neighborhood: 15 paragraphs around cursor
						if (cursorIndex !== -1) {
							var cursorStart = Math.max(0, cursorIndex - 7);
							var cursorEnd = Math.min(elementsCount, cursorIndex + 8);
							for (var i = cursorStart; i < cursorEnd; i++) {
								indexSet[i] = true;
							}
						}
						
						for (var idx in indexSet) {
							indicesToSerialize.push(parseInt(idx, 10));
						}
						indicesToSerialize.sort(function(a, b) { return a - b; });
					}
					
					for (var sIdx = 0; sIdx < indicesToSerialize.length; sIdx++) {
						var i = indicesToSerialize[sIdx];
						try {
							var oElement = oDocument.GetElement(i);
							if (!oElement) continue;
							
							var type = oElement.GetClassType();
							
							if (type === "paragraph") {
								var oText = oElement.GetText() || "";
								var paraStyle = (targetMode !== "minimal") ? extractParagraphStyle(oElement) : null;
								
								var cleanText = oText.trim().replace(/[\r\n\t]+/g, '');
								var isHeading = false;
								
								if (targetMode === "full" && paraStyle) {
									if ((paraStyle.fontSize * 2 >= 28 || (paraStyle.bold && paraStyle.fontSize * 2 >= 24)) && cleanText.length > 0 && cleanText.length < 150) {
										isHeading = true;
									}
									if (cleanText.length > 3 && cleanText.length < 80 && cleanText === cleanText.toUpperCase() && !/^\d+$/.test(cleanText)) {
										isHeading = true;
									}
									if (/^(Chapter\s+\d+|\d+(\.\d+)*\s+[A-Za-z])/i.test(cleanText) && cleanText.length < 100) {
										isHeading = true;
									}
								}
								
								var runsData = [];
								if (targetMode === "full" && paraStyle) {
									runsData = serializeRunsInside(oElement, paraStyle);
								}
								
								var elementJSON = {
									type: "paragraph",
									index: i,
									text: oText
								};
								
								if (targetMode !== "minimal" && paraStyle) {
									elementJSON.style = compressParagraphStyle(paraStyle);
								}
								
								if (targetMode === "full" && runsData.length > 0) {
									var isHomogeneous = true;
									for (var k = 0; k < runsData.length; k++) {
										if (runsData[k].style) {
											isHomogeneous = false;
											break;
										}
									}
									if (!isHomogeneous) {
										elementJSON.runs = runsData;
									}
								}
								
								if (isHeading) {
									if (currentSection.elements.length > 0) {
										sections.push(currentSection);
									}
									currentSection = {
										title: oText,
										elements: [elementJSON]
									};
								} else {
									currentSection.elements.push(elementJSON);
								}
								
							} else if (type === "table" && (targetMode === "full" || targetMode === "medium")) {
								var tableJSON = {
									type: "table",
									index: i,
									rows: []
								};
								
								try {
									var rowCount = oElement.GetRowsCount();
									var rowLimit = Math.min(rowCount, 15);
									for (var r = 0; r < rowLimit; r++) {
										var oRow = oElement.GetRow(r);
										var cellsJSON = [];
										if (oRow) {
											var cellCount = oRow.GetCellsCount();
											var cellLimit = Math.min(cellCount, 8);
											for (var c = 0; c < cellLimit; c++) {
												var oCell = oRow.GetCell(c);
												var cellText = "";
												if (oCell) {
													var cellParagraphs = oCell.GetContent().GetAllParagraphs();
													var pTexts = [];
													for (var p = 0; p < Math.min(cellParagraphs.length, 5); p++) {
														pTexts.push(cellParagraphs[p].GetText() || "");
													}
													cellText = pTexts.join("\n");
												}
												cellsJSON.push({
													cellIndex: c,
													text: cellText
												});
											}
										}
										tableJSON.rows.push({
											rowIndex: r,
											cells: cellsJSON
										});
									}
								} catch(eTable) {}
								
								currentSection.elements.push(tableJSON);
							}
						} catch(pErr) {}
					}
					
					if (currentSection.elements.length > 0 || sections.length === 0) {
						sections.push(currentSection);
					}
				}
				
				return JSON.stringify({
					mode: isSelection ? "selection" : "document",
					targetMode: targetMode,
					metadata: {
						totalElements: elementsCount,
						selectedElementsCount: isSelection ? selectedParagraphs.length : elementsCount,
						selectionRange: isSelection ? { start: firstAbsIndex, end: lastAbsIndex } : null,
						pageSettings: pageSettings,
						cursorIndex: cursorIndex
					},
					documentHeadings: documentHeadings,
					surroundingContext: isSelection ? {
						preceding: precedingContext,
						succeeding: succeedingContext
					} : null,
					sectionsCount: sections.length,
					sections: sections
				});
			}, false, true, function(result) {
				clearTimeout(failTimeout);
				if (result) {
					resolve(result);
				} else {
					reject(new Error("Unable to read active document/selection contents."));
				}
			});
		});
	}

	// Unified LLM Requester supporting Groq API
	async function queryActiveLLM(messages, temperature = 0.1, isJsonMode = false) {
		const controller = new AbortController();
		const timeoutId = setTimeout(() => controller.abort(), 25000); // 25 seconds timeout

		try {
			const apiKey = localStorage.getItem('groq_copilot_key');
			const model = localStorage.getItem('groq_copilot_model') || 'llama-3.3-70b-versatile';
			
			if (!apiKey) {
				throw new Error("Groq API Key is not configured. Add it in Settings.");
			}
			
			const requestBody = {
				model: model,
				messages: messages,
				temperature: temperature
			};
			
			if (isJsonMode) {
				requestBody.response_format = { type: 'json_object' };
			}
			
			const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
				method: 'POST',
				headers: {
					'Authorization': `Bearer ${apiKey}`,
					'Content-Type': 'application/json'
				},
				body: JSON.stringify(requestBody),
				signal: controller.signal
			});
			
			clearTimeout(timeoutId);
			
			if (!response.ok) {
				const errorText = await response.text().catch(() => '');
				let errorMsg = `HTTP ${response.status}`;
				try {
					const errorData = JSON.parse(errorText);
					errorMsg = errorData.error?.message || errorMsg;
				} catch (parseErr) {
					if (errorText) errorMsg = `${errorMsg}: ${errorText.substring(0, 100)}`;
				}
				throw new Error(errorMsg);
			}
			
			const data = await response.json();
			return data.choices[0].message.content;
		} catch (err) {
			clearTimeout(timeoutId);
			if (err.name === 'AbortError') {
				throw new Error("API request timed out after 25 seconds. Please check your network connection or try again.");
			}
			throw err;
		}
	}

	// Query LLM with robust schema and selection context mapping
	async function queryLLM(docData, prompt, isSelection = false) {
		const systemMessage = `You are a professional document typesetter and layout agent. Your task is to analyze the provided JSON representation of a ${isSelection ? 'selected range of a document' : 'document'} and generate the requested style or content changes as a valid JSON object.
		
Each paragraph and table has a unique, absolute "index" identifying its location in the document.

CONTEXT-AWARE FEATURES & BOUNDARIES:
- The input JSON contains a "documentHeadings" outline array that identifies the headers of the document, their levels, and their target paragraph indices. Use this to maintain proper header structure and hierarchy!
- When you are editing a selected range, "surroundingContext" provides the preceding and succeeding paragraphs. Use this surrounding context to perform boundary-conscious, accurate, and styling-consistent text and layout updates that blend seamlessly into the document.
- The input metadata has "pageSettings" detailing the active margins and page orientation. Ensure your generated layout complies with these boundary limits!

You must output a JSON object containing a "changes" key which holds an array of edit commands. Each edit command must have the following structure:
{
  "changes": [
    {
      "action": "pasteHTML",
      "targetIndex": 0,
      "properties": {
        "html": "<h1>Rich Document Title</h1><p style='text-align:justify;'>Paragraph with <span style='color:#ff0000;font-weight:bold;'>red bold text</span> and <i>italic examples</i>...</p>"
      }
    }
  ]
}

Available actions:
- "pasteHTML": CRITICAL & HIGHLY PREFERRED action for generating new documents, writing essays, creating extensive articles, letters, reports, or executing large-scale structural text replacements. This passes a complete, richly-styled HTML string to the document editor, which ONLYOFFICE natively renders with perfect layout fidelity. The "properties" MUST contain an "html" key with the complete, beautifully typeset HTML.
  * targetIndex: The paragraph index where this content should be inserted/pasted (e.g. overwriting the active selection or replacing text).
  * properties: { "html": "<html string with h1, h2, p, ul, ol, li, and inline CSS style rules like text-align:justify; font-family:'Times New Roman'; font-size:12pt; color:#ff0000; text-decoration:underline; font-weight:bold; background-color:yellow;>" }
  * EXTENDED HTML TAGS & INLINE CSS PROPERTIES SUPPORTED:
    - <sup> (superscript), <sub> (subscript), <small> (small caps), <big> (caps with larger size), <del>/<s> (strikeout).
    - style="vertical-align: super | sub;" (superscript / subscript)
    - style="letter-spacing: 2pt;" (character spacing)
    - style="text-transform: uppercase | lowercase;" (caps / lowercase)
    - style="font-variant: small-caps;" (small caps)
    - style="text-decoration: underline | line-through | double-line-through;" (supports double strikeout)
    - style="margin-left: 20px; margin-right: 20px; text-indent: 10px;" (left, right, and first-line indentation)
- "modifyStyle": Set simple fonts, size, spacing, bold, alignment, color, or minor text updates on an existing paragraph index.
- "createParagraph": Create a new blank paragraph after the targetIndex.
- "deleteParagraph": Remove this paragraph from the document.
Formatting & units specifications for "modifyStyle":
- "fontName" (string, e.g. "Arial", "Georgia", "Inter", "Times New Roman", "Courier New")
- "fontSize" (number): Must be in standard points (e.g., 11 for 11pt, 12 for 12pt, 19 for 19pt).
- "bold" (boolean)
- "italic" (boolean)
- "underline" (boolean)
- "strikeout" (boolean)
- "doubleStrikeout" (boolean): Sets double-line strikeout formatting.
- "smallCaps" (boolean)
- "caps" (boolean)
- "subscript" (boolean)
- "superscript" (boolean)
- "characterSpacing" (integer): Spacing/letter-spacing in dxa units (20 dxa = 1pt).
- "color" (string hex code for text/font color, e.g. "#1d4ed8" or "#e11d48")
- "highlight" (string, text highlight/background color, e.g. "yellow", "red", "green", "blue", "cyan", "magenta", "none")
- "alignment" (string: "left", "right", "center", "justify")
- "spacingAfter" (integer, in dxa: 120 = 6pt, 240 = 12pt, 360 = 18pt)
- "spacingBefore" (integer, in dxa)
- "lineSpacing" (number): Spacing multiplier (e.g. 1.15, 1.5, 2.0).
- "indLeft" (integer): Left paragraph indentation in dxa (e.g. 240 = 12pt).
- "indRight" (integer): Right paragraph indentation in dxa.
- "indFirstLine" (integer): First line indentation in dxa. Use negative value for hanging indent.
- "shading" (string hex code): Paragraph background color shading (e.g., "#f3f4f6").
- "newText" (string, optional - only provide for minor text edits or simple updates)

INLINE GRANULAR FORMATTING IN "newText" (Only when using "modifyStyle"):
If using "modifyStyle" and the user's prompt requests specific formatting of certain words, phrases, headings, or elements inside that paragraph, you can use standard inline HTML tags inside "newText".
However, remember that "pasteHTML" is the absolute standard and is 100% preferred over "modifyStyle" for all long-form content generation and writing tasks!

${isSelection ? 'IMPORTANT: You are targeting the ACTIVE SELECTION range. Apply modifications only targeting elements present inside the active selection.' : 'If the user wants a global change (e.g. "change the entire font color to yellow"), you MUST generate "modifyStyle" commands for EVERY single paragraph index in the document.'}
Respond ONLY with a valid JSON object. Do not include markdown code block formatting (like \`\`\`json).`;

		const userMessage = `Current Document Structure:
${JSON.stringify(docData, null, 2)}

User Request:
"${prompt}"`;

		const messages = [
			{ role: 'system', content: systemMessage },
			{ role: 'user', content: userMessage }
		];

		return await queryActiveLLM(messages, 0.1, true);
	}

	// Parse JSON array of changes
	function parseAIResponse(responseStr) {
		try {
			let cleanStr = responseStr.trim();
			if (cleanStr.startsWith('```')) {
				cleanStr = cleanStr.replace(/^```json/, '').replace(/^```/, '').replace(/```$/, '').trim();
			}
			
			const parsed = JSON.parse(cleanStr);
			
			if (Array.isArray(parsed)) {
				return parsed;
			} else if (parsed.plans && Array.isArray(parsed.plans)) {
				return parsed.plans;
			} else if (parsed.plan && Array.isArray(parsed.plan)) {
				return parsed.plan;
			} else if (parsed.actions && Array.isArray(parsed.actions)) {
				return parsed.actions;
			} else if (parsed.changes && Array.isArray(parsed.changes)) {
				return parsed.changes;
			} else if (parsed.commands && Array.isArray(parsed.commands)) {
				return parsed.commands;
			} else if (typeof parsed === 'object' && parsed !== null) {
				// If it is a single plan object rather than an array of plans
				if (parsed.action && parsed.properties) {
					return [parsed];
				}
				// If it's a wrapper object with plans nested under a single object
				for (const key in parsed) {
					if (Array.isArray(parsed[key])) {
						return parsed[key];
					}
				}
				return [parsed];
			}
			
			return [];
		} catch (e) {
			throw new Error("Could not parse a valid JSON action script from the AI's response.");
		}
	}



	// Sequential, Gated, Self-Healing executor engine utilizing Verification and Retry layers
	function executeSequentialEdits(changes, aiMessageBody) {
		// Normalize standard points to half-points for OnlyOffice API compatibility once
		if (changes && Array.isArray(changes)) {
			changes.forEach(change => {
				if (change && change.properties && change.properties.fontSize !== undefined) {
					change.properties.fontSize = Number(change.properties.fontSize) * 2;
				}
			});
		}

		let i = 0;
		let indexOffset = 0; // Dynamic tracking of index drift caused by creations, deletions, and Pastes
		let retryCount = 0;
		const maxRetries = 3;
		
		async function applyNext() {
			try {
				if (i >= changes.length) {
					log('All autonomous AI edits applied live, verified, and completed!', 'success');
					setStepperStep(3, "done", `Applied ${changes.length} edits successfully`);
					proposedChanges = null;
					executeBtn.disabled = false;
					isEditingAutonomously = false;
				appliedChangesCount = changes.length;
				undoAiBtn.style.display = 'inline-flex';

				// Show summary review panel with Keep/Undo buttons immediately inside the chat history
				renderChatPreview(aiMessageBody, changes, true);

				// Update execution telemetry
				lastExecutionDebugData.status = "Success (All action steps executed and verified successfully!)";
				if (typeof updateDebugViewer === 'function') updateDebugViewer();
				
				// Perform single clean refresh of structure view once editor modifications finish
				setTimeout(() => {
					refreshDocStructureView();
				}, 200);
				return;
			}

			const change = changes[i];
			const actionName = change.action || 'rewrite';
			const targetIndex = change.targetIndex;
			const actualTargetIndex = targetIndex + indexOffset;

			log(`Applying action [${actionName.toUpperCase()}] to element #${targetIndex + 1} (actual index #${actualTargetIndex + 1}). Attempt ${retryCount + 1}/${maxRetries}...`, 'info');

			setStepperStep(3, "running", `Applying ${actionName} on element #${targetIndex + 1} (${i + 1}/${changes.length})`);

			// Capture element state before applying change
			const beforeState = await captureElementState(actualTargetIndex);

			// Append to telemetry stateBefore (only on first attempt)
			if (retryCount === 0) {
				lastExecutionDebugData.stateBefore.push({
					stepIndex: i,
					action: actionName,
					targetIndex: targetIndex,
					actualIndex: actualTargetIndex,
					state: beforeState
				});
				if (typeof updateDebugViewer === 'function') updateDebugViewer();
			}

			// Wrapper to run the edit inside ONLYOFFICE Sandbox
			function runEditCommand() {
				return new Promise((resolve) => {
					window.Asc.scope.change = change;
					window.Asc.scope.actualTargetIndex = actualTargetIndex;
					window.Asc.scope.helperCode = parseAndApplyTextWithTags.toString();

					if (actionName === 'delete_paragraph' || actionName === 'deleteParagraph') {
						window.Asc.plugin.callCommand(function() {
							var actualTargetIndex = Asc.scope.actualTargetIndex;
							var oDocument = Api.GetDocument();
							var countBefore = oDocument.GetElementsCount();
							try { oDocument.RemoveElement(actualTargetIndex); } catch(e) {}
							var countAfter = oDocument.GetElementsCount();
							return { countBefore: countBefore, countAfter: countAfter };
						}, false, true, function(res) {
							var delta = res ? (res.countAfter - res.countBefore) : -1;
							resolve({ delta: delta });
						});
					} else if (actionName === 'create_paragraph' || actionName === 'createParagraph') {
						window.Asc.plugin.callCommand(function() {
							var change = Asc.scope.change;
							var actualTargetIndex = Asc.scope.actualTargetIndex;
							var oDocument = Api.GetDocument();
							var countBefore = oDocument.GetElementsCount();
							
							var parseAndApplyTextWithTags = function(oPar, htmlStr, defFont, defSize, defBold, defItalic, defUnderline, defStrikeout, defColorHex, defHighlight, pProps) {
								try { oPar.RemoveAllElements(); } catch(e) {}
								if (htmlStr) {
									htmlStr = htmlStr
										.replace(/\*\*(.*?)\*\*/g, '<b>$1</b>')
										.replace(/__(.*?)__/g, '<b>$1</b>')
										.replace(/\*(.*?)\*/g, '<i>$1</i>')
										.replace(/_(.*?)_/g, '<i>$1</i>');
								}
								var regex = /(<[^>]+>)/g;
								var parts = String(htmlStr || "").split(regex);
								var formatState = {
									fontName: pProps.fontName || defFont || "Calibri",
									fontSize: pProps.fontSize || defSize || 22,
									bold: pProps.bold !== undefined ? pProps.bold : (defBold !== undefined ? defBold : false),
									italic: pProps.italic !== undefined ? pProps.italic : (defItalic !== undefined ? defItalic : false),
									underline: pProps.underline !== undefined ? pProps.underline : (defUnderline !== undefined ? defUnderline : false),
									strikeout: pProps.strikeout !== undefined ? pProps.strikeout : (defStrikeout !== undefined ? defStrikeout : false),
									doubleStrikeout: pProps.doubleStrikeout !== undefined ? pProps.doubleStrikeout : false,
									smallCaps: pProps.smallCaps !== undefined ? pProps.smallCaps : false,
									caps: pProps.caps !== undefined ? pProps.caps : false,
									subscript: pProps.subscript !== undefined ? pProps.subscript : false,
									superscript: pProps.superscript !== undefined ? pProps.superscript : false,
									characterSpacing: pProps.characterSpacing !== undefined ? pProps.characterSpacing : 0,
									color: pProps.color || defColorHex || "#000000",
									highlight: pProps.highlight || defHighlight || "none"
								};

								if (!htmlStr) {
									var oRun = null;
									try { oRun = oPar.AddText(""); } catch(eText) {}
									if (oRun) {
										if (formatState.fontName) {
											try { oRun.SetFontFamily(formatState.fontName); } catch(e) {}
											try { oRun.SetFontName(formatState.fontName); } catch(e) {}
										}
										if (formatState.fontSize) {
											try { oRun.SetFontSize(formatState.fontSize); } catch(e) {}
										}
										try { oRun.SetBold(!!formatState.bold); } catch(e) {}
										try { oRun.SetItalic(!!formatState.italic); } catch(e) {}
										try { oRun.SetUnderline(!!formatState.underline); } catch(e) {}
										try { oRun.SetStrikeout(!!formatState.strikeout); } catch(e) {}
										try { oRun.SetDoubleStrikeout(!!formatState.doubleStrikeout); } catch(e) {}
										try { oRun.SetSmallCaps(!!formatState.smallCaps); } catch(e) {}
										try { oRun.SetCaps(!!formatState.caps); } catch(e) {}
										try { oRun.SetSubscript(!!formatState.subscript); } catch(e) {}
										try { oRun.SetSuperscript(!!formatState.superscript); } catch(e) {}
										try { if (formatState.characterSpacing) oRun.SetSpacing(formatState.characterSpacing); } catch(e) {}
										if (formatState.highlight) {
											try {
												var hl = formatState.highlight.toLowerCase().trim();
												if (hl === "none" || hl === "null" || hl === "default") oRun.SetHighlight("none");
												else if (hl.indexOf("yellow") !== -1 || hl === "#ffff00") oRun.SetHighlight("yellow");
												else if (hl.indexOf("green") !== -1 || hl === "#00ff00" || hl === "#008000") oRun.SetHighlight("green");
												else if (hl.indexOf("blue") !== -1 || hl === "#0000ff") oRun.SetHighlight("blue");
												else if (hl.indexOf("cyan") !== -1 || hl.indexOf("aqua") !== -1 || hl === "#00ffff") oRun.SetHighlight("cyan");
												else if (hl.indexOf("red") !== -1 || hl === "#ff0000") oRun.SetHighlight("red");
												else if (hl.indexOf("magenta") !== -1 || hl === "#ff00ff") oRun.SetHighlight("magenta");
												else if (hl.indexOf("gray") !== -1 || hl.indexOf("grey") !== -1 || hl === "#808080") oRun.SetHighlight("lightGray");
												else oRun.SetHighlight(hl);
											} catch(eHighlight) {}
										}
										if (formatState.color) {
											try {
												var hex = String(formatState.color).replace('#', '').trim();
												if (hex.length === 6) {
													var red = parseInt(hex.substring(0, 2), 16);
													var green = parseInt(hex.substring(2, 4), 16);
													var blue = parseInt(hex.substring(4, 6), 16);
													try { oRun.SetColor(Api.CreateColorFromRGB(red, green, blue)); } catch(eColor) {
														try { oRun.SetColor(red, green, blue); } catch(errHex) {}
													}
												}
											} catch(eColorOuter) {}
										}
									}
									return;
								}

								var stateStack = [JSON.parse(JSON.stringify(formatState))];
								for (var idx = 0; idx < parts.length; idx++) {
									var part = parts[idx];
									if (!part) continue;
									if (part.charAt(0) === '<' && part.charAt(part.length - 1) === '>') {
										var tagLower = part.toLowerCase();
										if (tagLower.indexOf("</") === 0) {
											if (stateStack.length > 1) {
												stateStack.pop();
												formatState = JSON.parse(JSON.stringify(stateStack[stateStack.length - 1]));
											}
										} else {
											var newState = JSON.parse(JSON.stringify(formatState));
											if (tagLower.indexOf("<b") === 0 || tagLower.indexOf("<strong") === 0) {
												newState.bold = true;
											} else if (tagLower.indexOf("<i") === 0 || tagLower.indexOf("<em") === 0) {
												newState.italic = true;
											} else if (tagLower.indexOf("<u") === 0) {
												newState.underline = true;
											} else if (tagLower.indexOf("<strike") === 0 || tagLower.indexOf("<del") === 0 || tagLower.indexOf("<s") === 0) {
												newState.strikeout = true;
											} else if (tagLower.indexOf("<sub>") === 0) {
												newState.subscript = true;
												newState.superscript = false;
											} else if (tagLower.indexOf("<sup>") === 0) {
												newState.superscript = true;
												newState.subscript = false;
											} else if (tagLower.indexOf("<small>") === 0) {
												newState.smallCaps = true;
											} else if (tagLower.indexOf("<big>") === 0) {
												newState.caps = true;
												newState.fontSize = Math.round(newState.fontSize * 1.2);
											} else if (tagLower.indexOf("<font") === 0) {
												var match = part.match(/color=["']([^"']+)["']/i);
												if (match && match[1]) newState.color = match[1];
												var matchFace = part.match(/face=["']([^"']+)["']/i);
												if (matchFace && matchFace[1]) newState.fontName = matchFace[1];
												var matchSize = part.match(/size=["']([^"']+)["']/i);
												if (matchSize && matchSize[1]) newState.fontSize = parseFloat(matchSize[1]);
											} else if (tagLower.indexOf("<mark") === 0) {
												var match = part.match(/color=["']([^"']+)["']/i);
												var styleMatch = part.match(/style=["']([^"']+)["']/i);
												if (match && match[1]) {
													newState.highlight = match[1];
												} else if (styleMatch && styleMatch[1]) {
													var styleStr = styleMatch[1];
													var declarations = styleStr.split(';');
													var foundBg = false;
													for (var d = 0; d < declarations.length; d++) {
														var dec = declarations[d].trim();
														if (!dec) continue;
														var pSplit = dec.split(':');
														if (pSplit.length >= 2) {
															var propName = pSplit[0].trim().toLowerCase();
															var propVal = pSplit.slice(1).join(':').trim().toLowerCase();
															if (propName === 'background-color' || propName === 'background' || propName === 'color') {
																newState.highlight = propVal;
																foundBg = true;
															}
														}
													}
													if (!foundBg) newState.highlight = "yellow";
												} else {
													newState.highlight = "yellow";
												}
											} else if (tagLower.indexOf("<span") === 0) {
												var styleMatch = part.match(/style=["']([^"']+)["']/i);
												if (styleMatch && styleMatch[1]) {
													var styleStr = styleMatch[1];
													var declarations = styleStr.split(';');
													for (var d = 0; d < declarations.length; d++) {
														var dec = declarations[d].trim();
														if (!dec) continue;
														var pSplit = dec.split(':');
														if (pSplit.length >= 2) {
															var propName = pSplit[0].trim().toLowerCase();
															var propVal = pSplit.slice(1).join(':').trim().toLowerCase();
															if (propName === 'font-weight') {
																if (propVal === 'bold' || propVal === '700' || propVal === '800' || propVal === '900') newState.bold = true;
																else if (propVal === 'normal' || propVal === '400') newState.bold = false;
															} else if (propName === 'font-style') {
																if (propVal === 'italic' || propVal === 'oblique') newState.italic = true;
																else if (propVal === 'normal') newState.italic = false;
															} else if (propName === 'text-decoration') {
																if (propVal.indexOf('underline') !== -1) newState.underline = true;
																if (propVal.indexOf('line-through') !== -1) newState.strikeout = true;
																if (propVal.indexOf('double-line-through') !== -1 || propVal.indexOf('double') !== -1) newState.doubleStrikeout = true;
															} else if (propName === 'color') {
																newState.color = propVal;
															} else if (propName === 'background-color' || propName === 'background') {
																newState.highlight = propVal;
															} else if (propName === 'font-family') {
																newState.fontName = propVal.replace(/['"]/g, '').trim();
															} else if (propName === 'font-size') {
																var numVal = parseFloat(propVal);
																if (propVal.indexOf('pt') !== -1) {
																	newState.fontSize = Math.round(numVal * 2);
																} else if (propVal.indexOf('px') !== -1) {
																	newState.fontSize = Math.round(numVal * 1.5);
																}
															} else if (propName === 'letter-spacing') {
																var numVal = parseFloat(propVal);
																if (propVal.indexOf('pt') !== -1) {
																	newState.characterSpacing = Math.round(numVal * 20);
																} else if (propVal.indexOf('px') !== -1) {
																	newState.characterSpacing = Math.round(numVal * 15);
																} else {
																	newState.characterSpacing = Math.round(numVal);
																}
															} else if (propName === 'text-transform') {
																if (propVal === 'uppercase') newState.caps = true;
																else if (propVal === 'lowercase') newState.caps = false;
															} else if (propName === 'font-variant') {
																if (propVal === 'small-caps') newState.smallCaps = true;
															} else if (propName === 'vertical-align') {
																if (propVal === 'super') {
																	newState.superscript = true;
																	newState.subscript = false;
																} else if (propVal === 'sub') {
																	newState.subscript = true;
																	newState.superscript = false;
																}
															}
														}
													}
												}
											}
											stateStack.push(newState);
											formatState = newState;
										}
									} else {
										var decText = part
											.replace(/&quot;/g, '"')
											.replace(/&lt;/g, '<')
											.replace(/&gt;/g, '>')
											.replace(/&amp;/g, '&')
											.replace(/&#39;/g, "'")
											.replace(/&apos;/g, "'");
										var oRun = null;
										try { oRun = oPar.AddText(decText); } catch(eText) {}
										if (oRun) {
											if (formatState.fontName) {
												try { oRun.SetFontFamily(formatState.fontName); } catch(e) {}
												try { oRun.SetFontName(formatState.fontName); } catch(e) {}
											}
											if (formatState.fontSize) {
												try { oRun.SetFontSize(formatState.fontSize); } catch(e) {}
											}
											try { oRun.SetBold(!!formatState.bold); } catch(e) {}
											try { oRun.SetItalic(!!formatState.italic); } catch(e) {}
											try { oRun.SetUnderline(!!formatState.underline); } catch(e) {}
											try { oRun.SetStrikeout(!!formatState.strikeout); } catch(e) {}
											try { oRun.SetDoubleStrikeout(!!formatState.doubleStrikeout); } catch(e) {}
											try { oRun.SetSmallCaps(!!formatState.smallCaps); } catch(e) {}
											try { oRun.SetCaps(!!formatState.caps); } catch(e) {}
											try { oRun.SetSubscript(!!formatState.subscript); } catch(e) {}
											try { oRun.SetSuperscript(!!formatState.superscript); } catch(e) {}
											try { if (formatState.characterSpacing) oRun.SetSpacing(formatState.characterSpacing); } catch(e) {}
											if (formatState.highlight) {
												try {
													var hl = formatState.highlight.toLowerCase().trim();
													if (hl === "none" || hl === "null" || hl === "default") oRun.SetHighlight("none");
													else if (hl.indexOf("yellow") !== -1 || hl === "#ffff00") oRun.SetHighlight("yellow");
													else if (hl.indexOf("green") !== -1 || hl === "#00ff00" || hl === "#008000") oRun.SetHighlight("green");
													else if (hl.indexOf("blue") !== -1 || hl === "#0000ff") oRun.SetHighlight("blue");
													else if (hl.indexOf("cyan") !== -1 || hl.indexOf("aqua") !== -1 || hl === "#00ffff") oRun.SetHighlight("cyan");
													else if (hl.indexOf("red") !== -1 || hl === "#ff0000") oRun.SetHighlight("red");
													else if (hl.indexOf("magenta") !== -1 || hl === "#ff00ff") oRun.SetHighlight("magenta");
													else if (hl.indexOf("gray") !== -1 || hl.indexOf("grey") !== -1 || hl === "#808080") oRun.SetHighlight("lightGray");
													else oRun.SetHighlight(hl);
												} catch(eHighlight) {}
											}
											if (formatState.color) {
												try {
													var hex = String(formatState.color).replace('#', '').trim();
													if (hex.length === 6) {
														var red = parseInt(hex.substring(0, 2), 16);
														var green = parseInt(hex.substring(2, 4), 16);
														var blue = parseInt(hex.substring(4, 6), 16);
														try { oRun.SetColor(Api.CreateColorFromRGB(red, green, blue)); } catch(eColor) {
															try { oRun.SetColor(red, green, blue); } catch(errHex) {}
														}
													} else {
														var namedColors = {
															"red": [255, 0, 0], "green": [0, 128, 0], "blue": [0, 0, 255],
															"yellow": [255, 255, 0], "black": [0, 0, 0], "white": [255, 255, 255],
															"gray": [128, 128, 128], "purple": [128, 0, 128], "orange": [255, 165, 0]
														};
														if (namedColors[hex.toLowerCase()]) {
															var rgb = namedColors[hex.toLowerCase()];
															oRun.SetColor(Api.CreateColorFromRGB(rgb[0], rgb[1], rgb[2]));
														}
													}
												} catch(eColorOuter) {}
											}
										}
									}
								}
							};
							
							// Clamp index to prevent out-of-bounds AddElement errors when appending
							if (actualTargetIndex >= countBefore) {
								actualTargetIndex = countBefore - 1;
							}
							if (actualTargetIndex < 0) {
								actualTargetIndex = 0;
							}
							
							var origFont = "Calibri";
							var origSize = 22;
							var origBold = false;
							var origItalic = false;
							var origUnderline = false;
							var origStrikeout = false;
							var origColorHex = "#000000";
							var origHighlight = "none";
							
							var oRefParagraph = oDocument.GetElement(actualTargetIndex);
							if (oRefParagraph) {
								try {
									var runCount = oRefParagraph.GetElementsCount();
									if (runCount > 0) {
										var firstRun = oRefParagraph.GetElement(0);
										if (firstRun) {
											var textPr = null;
											try { if (typeof firstRun.GetTextPr === "function") textPr = firstRun.GetTextPr(); } catch(e) {}
											if (textPr) {
												try { 
													if (typeof textPr.GetFontName === "function") {
														origFont = textPr.GetFontName() || origFont;
													}
												} catch(e) {}
												try { if (typeof textPr.GetFontSize === "function") origSize = textPr.GetFontSize() || origSize; } catch(e) {}
												try { if (typeof textPr.GetBold === "function") origBold = textPr.GetBold() || origBold; } catch(e) {}
												try { if (typeof textPr.GetItalic === "function") origItalic = textPr.GetItalic() || origItalic; } catch(e) {}
												try { if (typeof textPr.GetUnderline === "function") origUnderline = !!textPr.GetUnderline(); } catch(e) {}
												try { if (typeof textPr.GetStrikeout === "function") origStrikeout = !!textPr.GetStrikeout(); } catch(e) {}
												try {
													if (typeof textPr.GetColor === "function") {
														var c = textPr.GetColor();
														if (c && typeof c.GetHex === "function") origColorHex = c.GetHex() || origColorHex;
													}
												} catch(e) {}
												try {
													if (typeof textPr.GetHighlight === "function") {
														var hl = textPr.GetHighlight();
														if (hl) {
															if (typeof hl === "string") origHighlight = hl;
															else if (typeof hl.GetHex === "function") origHighlight = hl.GetHex() || origHighlight;
														}
													}
												} catch(e) {}
											}
										}
									}
								} catch(e) {}
							}
							
							var oNewParagraph = Api.CreateParagraph();
							var oProps = change.properties || {};
							try {
								oDocument.AddElement(actualTargetIndex + 1, oNewParagraph);
								
								if (oProps.newText) {
									parseAndApplyTextWithTags(oNewParagraph, oProps.newText, origFont, origSize, origBold, origItalic, origUnderline, origStrikeout, origColorHex, origHighlight, oProps);
								}
								
								// Apply list numbering directly if specified in properties
								if (oProps.listType) {
									var listType = oProps.listType === "bullet" ? "bulleted" : "numbered";
									var oNumbering = oDocument.CreateNumbering(listType);
									if (oNumbering) {
										var level = oProps.level !== undefined ? Number(oProps.level) : 0;
										var oLevel = oNumbering.GetLevel(level);
										if (oLevel) {
											var style = oProps.style || (oProps.listType === "bullet" ? "bullet" : "decimal");
											var formatString = oProps.formatString || (oProps.listType === "bullet" ? "•" : "%1.");
											oLevel.SetCustomType(style, formatString, "left");
											oNewParagraph.SetNumbering(oLevel);
										}
									}
								}
								
								// Apply indents directly if specified in properties
								if (oProps.indLeft !== undefined || oProps.indRight !== undefined || oProps.indFirstLine !== undefined) {
									var oParaPr = oNewParagraph.GetParaPr();
									if (oParaPr) {
										if (oProps.indLeft !== undefined) oParaPr.SetIndLeft(Number(oProps.indLeft));
										if (oProps.indRight !== undefined) oParaPr.SetIndRight(Number(oProps.indRight));
										if (oProps.indFirstLine !== undefined) oParaPr.SetIndFirstLine(Number(oProps.indFirstLine));
									}
								}
							} catch(e) {}
							
							var countAfter = oDocument.GetElementsCount();
							return { countBefore: countBefore, countAfter: countAfter };
						}, false, true, function(res) {
							var delta = res ? (res.countAfter - res.countBefore) : 1;
							resolve({ delta: delta });
						});
					} else if (actionName === 'paste_html' || actionName === 'pasteHTML') {
						window.Asc.plugin.callCommand(function() {
							var actualTargetIndex = Asc.scope.actualTargetIndex;
							var oDocument = Api.GetDocument();
							var countBefore = oDocument.GetElementsCount();
							if (actualTargetIndex >= countBefore) {
								actualTargetIndex = countBefore - 1;
							}
							if (actualTargetIndex < 0) {
								actualTargetIndex = 0;
							}
							var oParagraph = oDocument.GetElement(actualTargetIndex);
							if (oParagraph) {
								oParagraph.Select();
							}
							return countBefore;
						}, false, true, function(countBefore) {
							window.Asc.plugin.executeMethod("PasteHtml", [change.properties.html || ''], function() {
								window.Asc.plugin.callCommand(function() {
									return Api.GetDocument().GetElementsCount();
								}, false, true, function(countAfter) {
									var delta = (countAfter !== undefined && countBefore !== undefined) ? (countAfter - countBefore) : 0;
									resolve({ delta: delta });
								});
							});
						});
					} else if (actionName === 'make_list' || actionName === 'makeList') {
						window.Asc.plugin.callCommand(function() {
							var change = Asc.scope.change;
							var actualTargetIndex = Asc.scope.actualTargetIndex;
							var oProps = change.properties || {};
							var oDocument = Api.GetDocument();
							var countBefore = oDocument.GetElementsCount();
							if (actualTargetIndex >= countBefore) {
								actualTargetIndex = countBefore - 1;
							}
							if (actualTargetIndex < 0) {
								actualTargetIndex = 0;
							}
							var oParagraph = oDocument.GetElement(actualTargetIndex);
							if (oParagraph && oParagraph.GetClassType() === "paragraph") {
								var listType = oProps.listType === "bullet" ? "bulleted" : "numbered";
								var oNumbering = oDocument.CreateNumbering(listType);
								if (oNumbering) {
									var level = oProps.level !== undefined ? Number(oProps.level) : 0;
									var oLevel = oNumbering.GetLevel(level);
									if (oLevel) {
										var style = oProps.style || (oProps.listType === "bullet" ? "bullet" : "decimal");
										var formatString = oProps.formatString || (oProps.listType === "bullet" ? "•" : "%1.");
										oLevel.SetCustomType(style, formatString, "left");
										oParagraph.SetNumbering(oLevel);
									}
								}
							}
							return true;
						}, false, true, function() {
							resolve({ delta: 0 });
						});
					} else if (actionName === 'table_action' || actionName === 'tableAction') {
						window.Asc.plugin.callCommand(function() {
							var change = Asc.scope.change;
							var actualTargetIndex = Asc.scope.actualTargetIndex;
							var oProps = change.properties || {};
							var subAction = change.subAction || oProps.subAction;
							var oDocument = Api.GetDocument();
							var countBefore = oDocument.GetElementsCount();
							
							// Clamp index to prevent out-of-bounds AddElement errors when appending
							if (actualTargetIndex >= countBefore) {
								actualTargetIndex = countBefore - 1;
							}
							if (actualTargetIndex < 0) {
								actualTargetIndex = 0;
							}
							
							if (subAction === 'create') {
								var rows = Number(oProps.rows || 2);
								var cols = Number(oProps.cols || 2);
								var oTable = Api.CreateTable(cols, rows);
								if (oTable) {
									// Populate cellData if provided
									if (oProps.cellData && Array.isArray(oProps.cellData)) {
										for (var r = 0; r < Math.min(rows, oProps.cellData.length); r++) {
											var rowData = oProps.cellData[r];
											if (rowData && Array.isArray(rowData)) {
												for (var c = 0; c < Math.min(cols, rowData.length); c++) {
													var textVal = String(rowData[c] || "");
													var cell = oTable.GetCell(r, c);
													if (cell) {
														var cellContent = cell.GetContent();
														var cellParagraphs = cellContent.GetAllParagraphs();
														if (cellParagraphs && cellParagraphs.length > 0) {
															cellParagraphs[0].RemoveAllElements();
															cellParagraphs[0].AddText(textVal);
														} else {
															var oPara = Api.CreateParagraph();
															oPara.AddText(textVal);
															cellContent.AddElement(0, oPara);
														}
													}
												}
											}
										}
									}
									oDocument.AddElement(actualTargetIndex + 1, oTable);
									return { delta: 1 };
								}
								return { delta: 0 };
							}
							
							var oTable = oDocument.GetElement(actualTargetIndex);
							if (oTable && oTable.GetClassType() === "table") {
								if (subAction === 'add_row' || subAction === 'addRow') {
									var rowIndex = oProps.rowIndex !== undefined ? Number(oProps.rowIndex) : oTable.GetRowsCount() - 1;
									var before = !!oProps.before;
									var refRow = oTable.GetRow(rowIndex);
									if (refRow) {
										var refCell = refRow.GetCell(0);
										if (refCell) oTable.AddRow(refCell, before);
									} else {
										oTable.AddRow();
									}
								} else if (subAction === 'add_column' || subAction === 'addColumn') {
									oTable.AddColumn();
								} else if (subAction === 'delete_row' || subAction === 'deleteRow') {
									var rowIndex = Number(oProps.rowIndex);
									oTable.RemoveRow(rowIndex);
								} else if (subAction === 'delete_column' || subAction === 'deleteColumn') {
									var colIndex = Number(oProps.colIndex);
									var oRow = oTable.GetRow(0);
									if (oRow) {
										var oCell = oRow.GetCell(colIndex);
										if (oCell) oCell.RemoveColumn();
									}
								} else if (subAction === 'merge_cells' || subAction === 'mergeCells') {
									var cellCoords = oProps.cells || [];
									var cellObjects = [];
									for (var k = 0; k < cellCoords.length; k++) {
										var coords = cellCoords[k];
										var cell = oTable.GetCell(coords[0], coords[1]);
										if (cell) cellObjects.push(cell);
									}
									if (cellObjects.length > 1) {
										oTable.MergeCells(cellObjects);
									}
								} else if (subAction === 'cell_shading' || subAction === 'cellShading') {
									var cellCoords = oProps.cells || [];
									var colorHex = oProps.color || "#ffffff";
									for (var k = 0; k < cellCoords.length; k++) {
										var coords = cellCoords[k];
										var cell = oTable.GetCell(coords[0], coords[1]);
										if (cell && typeof cell.SetBackgroundColor === 'function') {
											cell.SetBackgroundColor(Api.HexColor(colorHex));
										}
									}
								} else if (subAction === 'cell_borders' || subAction === 'cellBorders') {
									var cellCoords = oProps.cells || [];
									var style = oProps.borderStyle || "single";
									var size = oProps.borderSize !== undefined ? Number(oProps.borderSize) : 8;
									var colorHex = oProps.borderColor || "#000000";
									var hex = String(colorHex).replace('#', '').trim();
									var r = 0, g = 0, b = 0;
									if (hex.length === 6) {
										r = parseInt(hex.substring(0, 2), 16);
										g = parseInt(hex.substring(2, 4), 16);
										b = parseInt(hex.substring(4, 6), 16);
									}
									for (var k = 0; k < cellCoords.length; k++) {
										var coords = cellCoords[k];
										var cell = oTable.GetCell(coords[0], coords[1]);
										if (cell) {
											if (typeof cell.SetBorderBottom === 'function') cell.SetBorderBottom(style, size, 0, r, g, b);
											if (typeof cell.SetBorderLeft === 'function') cell.SetBorderLeft(style, size, 0, r, g, b);
											if (typeof cell.SetBorderRight === 'function') cell.SetBorderRight(style, size, 0, r, g, b);
											if (typeof cell.SetBorderTop === 'function') cell.SetBorderTop(style, size, 0, r, g, b);
										}
									}
								} else if (subAction === 'set_cell_text' || subAction === 'setCellText') {
									var cellCoords = oProps.cells || [];
									var textVal = oProps.newText || "";
									for (var k = 0; k < cellCoords.length; k++) {
										var coords = cellCoords[k];
										var cell = oTable.GetCell(coords[0], coords[1]);
										if (cell) {
											var cellContent = cell.GetContent();
											var cellParagraphs = cellContent.GetAllParagraphs();
											if (cellParagraphs && cellParagraphs.length > 0) {
												cellParagraphs[0].RemoveAllElements();
												cellParagraphs[0].AddText(textVal);
											} else {
												var oPara = Api.CreateParagraph();
												oPara.AddText(textVal);
												cellContent.AddElement(0, oPara);
											}
										}
									}
								}
							}
							return { delta: 0 };
						}, false, true, function(res) {
							var d = res ? (res.delta || 0) : 0;
							resolve({ delta: d });
						});
					} else {
						// formatting or rewriting
						window.Asc.plugin.callCommand(function() {
							var change = Asc.scope.change;
							var actualTargetIndex = Asc.scope.actualTargetIndex;
							var oDocument = Api.GetDocument();
							var countBefore = oDocument.GetElementsCount();
							
							var parseAndApplyTextWithTags = function(oPar, htmlStr, defFont, defSize, defBold, defItalic, defUnderline, defStrikeout, defColorHex, defHighlight, pProps) {
								try { oPar.RemoveAllElements(); } catch(e) {}
								if (htmlStr) {
									htmlStr = htmlStr
										.replace(/\*\*(.*?)\*\*/g, '<b>$1</b>')
										.replace(/__(.*?)__/g, '<b>$1</b>')
										.replace(/\*(.*?)\*/g, '<i>$1</i>')
										.replace(/_(.*?)_/g, '<i>$1</i>');
								}
								var regex = /(<[^>]+>)/g;
								var parts = String(htmlStr || "").split(regex);
								var formatState = {
									fontName: pProps.fontName || defFont || "Calibri",
									fontSize: pProps.fontSize || defSize || 22,
									bold: pProps.bold !== undefined ? pProps.bold : (defBold !== undefined ? defBold : false),
									italic: pProps.italic !== undefined ? pProps.italic : (defItalic !== undefined ? defItalic : false),
									underline: pProps.underline !== undefined ? pProps.underline : (defUnderline !== undefined ? defUnderline : false),
									strikeout: pProps.strikeout !== undefined ? pProps.strikeout : (defStrikeout !== undefined ? defStrikeout : false),
									doubleStrikeout: pProps.doubleStrikeout !== undefined ? pProps.doubleStrikeout : false,
									smallCaps: pProps.smallCaps !== undefined ? pProps.smallCaps : false,
									caps: pProps.caps !== undefined ? pProps.caps : false,
									subscript: pProps.subscript !== undefined ? pProps.subscript : false,
									superscript: pProps.superscript !== undefined ? pProps.superscript : false,
									characterSpacing: pProps.characterSpacing !== undefined ? pProps.characterSpacing : 0,
									color: pProps.color || defColorHex || "#000000",
									highlight: pProps.highlight || defHighlight || "none"
								};

								if (!htmlStr) {
									var oRun = null;
									try { oRun = oPar.AddText(""); } catch(eText) {}
									if (oRun) {
										if (formatState.fontName) {
											try { oRun.SetFontFamily(formatState.fontName); } catch(e) {}
											try { oRun.SetFontName(formatState.fontName); } catch(e) {}
										}
										if (formatState.fontSize) {
											try { oRun.SetFontSize(formatState.fontSize); } catch(e) {}
										}
										try { oRun.SetBold(!!formatState.bold); } catch(e) {}
										try { oRun.SetItalic(!!formatState.italic); } catch(e) {}
										try { oRun.SetUnderline(!!formatState.underline); } catch(e) {}
										try { oRun.SetStrikeout(!!formatState.strikeout); } catch(e) {}
										try { oRun.SetDoubleStrikeout(!!formatState.doubleStrikeout); } catch(e) {}
										try { oRun.SetSmallCaps(!!formatState.smallCaps); } catch(e) {}
										try { oRun.SetCaps(!!formatState.caps); } catch(e) {}
										try { oRun.SetSubscript(!!formatState.subscript); } catch(e) {}
										try { oRun.SetSuperscript(!!formatState.superscript); } catch(e) {}
										try { if (formatState.characterSpacing) oRun.SetSpacing(formatState.characterSpacing); } catch(e) {}
										if (formatState.highlight) {
											try {
												var hl = formatState.highlight.toLowerCase().trim();
												if (hl === "none" || hl === "null" || hl === "default") oRun.SetHighlight("none");
												else if (hl.indexOf("yellow") !== -1 || hl === "#ffff00") oRun.SetHighlight("yellow");
												else if (hl.indexOf("green") !== -1 || hl === "#00ff00" || hl === "#008000") oRun.SetHighlight("green");
												else if (hl.indexOf("blue") !== -1 || hl === "#0000ff") oRun.SetHighlight("blue");
												else if (hl.indexOf("cyan") !== -1 || hl.indexOf("aqua") !== -1 || hl === "#00ffff") oRun.SetHighlight("cyan");
												else if (hl.indexOf("red") !== -1 || hl === "#ff0000") oRun.SetHighlight("red");
												else if (hl.indexOf("magenta") !== -1 || hl === "#ff00ff") oRun.SetHighlight("magenta");
												else if (hl.indexOf("gray") !== -1 || hl.indexOf("grey") !== -1 || hl === "#808080") oRun.SetHighlight("lightGray");
												else oRun.SetHighlight(hl);
											} catch(eHighlight) {}
										}
										if (formatState.color) {
											try {
												var hex = String(formatState.color).replace('#', '').trim();
												if (hex.length === 6) {
													var red = parseInt(hex.substring(0, 2), 16);
													var green = parseInt(hex.substring(2, 4), 16);
													var blue = parseInt(hex.substring(4, 6), 16);
													try { oRun.SetColor(Api.CreateColorFromRGB(red, green, blue)); } catch(eColor) {
														try { oRun.SetColor(red, green, blue); } catch(errHex) {}
													}
												}
											} catch(eColorOuter) {}
										}
									}
									return;
								}

								var stateStack = [JSON.parse(JSON.stringify(formatState))];
								for (var idx = 0; idx < parts.length; idx++) {
									var part = parts[idx];
									if (!part) continue;
									if (part.charAt(0) === '<' && part.charAt(part.length - 1) === '>') {
										var tagLower = part.toLowerCase();
										if (tagLower.indexOf("</") === 0) {
											if (stateStack.length > 1) {
												stateStack.pop();
												formatState = JSON.parse(JSON.stringify(stateStack[stateStack.length - 1]));
											}
										} else {
											var newState = JSON.parse(JSON.stringify(formatState));
											if (tagLower.indexOf("<b") === 0 || tagLower.indexOf("<strong") === 0) {
												newState.bold = true;
											} else if (tagLower.indexOf("<i") === 0 || tagLower.indexOf("<em") === 0) {
												newState.italic = true;
											} else if (tagLower.indexOf("<u") === 0) {
												newState.underline = true;
											} else if (tagLower.indexOf("<strike") === 0 || tagLower.indexOf("<del") === 0 || tagLower.indexOf("<s") === 0) {
												newState.strikeout = true;
											} else if (tagLower.indexOf("<sub>") === 0) {
												newState.subscript = true;
												newState.superscript = false;
											} else if (tagLower.indexOf("<sup>") === 0) {
												newState.superscript = true;
												newState.subscript = false;
											} else if (tagLower.indexOf("<small>") === 0) {
												newState.smallCaps = true;
											} else if (tagLower.indexOf("<big>") === 0) {
												newState.caps = true;
												newState.fontSize = Math.round(newState.fontSize * 1.2);
											} else if (tagLower.indexOf("<font") === 0) {
												var match = part.match(/color=["']([^"']+)["']/i);
												if (match && match[1]) newState.color = match[1];
												var matchFace = part.match(/face=["']([^"']+)["']/i);
												if (matchFace && matchFace[1]) newState.fontName = matchFace[1];
												var matchSize = part.match(/size=["']([^"']+)["']/i);
												if (matchSize && matchSize[1]) newState.fontSize = parseFloat(matchSize[1]);
											} else if (tagLower.indexOf("<mark") === 0) {
												var match = part.match(/color=["']([^"']+)["']/i);
												var styleMatch = part.match(/style=["']([^"']+)["']/i);
												if (match && match[1]) {
													newState.highlight = match[1];
												} else if (styleMatch && styleMatch[1]) {
													var styleStr = styleMatch[1];
													var declarations = styleStr.split(';');
													var foundBg = false;
													for (var d = 0; d < declarations.length; d++) {
														var dec = declarations[d].trim();
														if (!dec) continue;
														var pSplit = dec.split(':');
														if (pSplit.length >= 2) {
															var propName = pSplit[0].trim().toLowerCase();
															var propVal = pSplit.slice(1).join(':').trim().toLowerCase();
															if (propName === 'background-color' || propName === 'background' || propName === 'color') {
																newState.highlight = propVal;
																foundBg = true;
															}
														}
													}
													if (!foundBg) newState.highlight = "yellow";
												} else {
													newState.highlight = "yellow";
												}
											} else if (tagLower.indexOf("<span") === 0) {
												var styleMatch = part.match(/style=["']([^"']+)["']/i);
												if (styleMatch && styleMatch[1]) {
													var styleStr = styleMatch[1];
													var declarations = styleStr.split(';');
													for (var d = 0; d < declarations.length; d++) {
														var dec = declarations[d].trim();
														if (!dec) continue;
														var pSplit = dec.split(':');
														if (pSplit.length >= 2) {
															var propName = pSplit[0].trim().toLowerCase();
															var propVal = pSplit.slice(1).join(':').trim().toLowerCase();
															if (propName === 'font-weight') {
																if (propVal === 'bold' || propVal === '700' || propVal === '800' || propVal === '900') newState.bold = true;
																else if (propVal === 'normal' || propVal === '400') newState.bold = false;
															} else if (propName === 'font-style') {
																if (propVal === 'italic' || propVal === 'oblique') newState.italic = true;
																else if (propVal === 'normal') newState.italic = false;
															} else if (propName === 'text-decoration') {
																if (propVal.indexOf('underline') !== -1) newState.underline = true;
																if (propVal.indexOf('line-through') !== -1) newState.strikeout = true;
																if (propVal.indexOf('double-line-through') !== -1 || propVal.indexOf('double') !== -1) newState.doubleStrikeout = true;
															} else if (propName === 'color') {
																newState.color = propVal;
															} else if (propName === 'background-color' || propName === 'background') {
																newState.highlight = propVal;
															} else if (propName === 'font-family') {
																newState.fontName = propVal.replace(/['"]/g, '').trim();
															} else if (propName === 'font-size') {
																var numVal = parseFloat(propVal);
																if (propVal.indexOf('pt') !== -1) {
																	newState.fontSize = Math.round(numVal * 2);
																} else if (propVal.indexOf('px') !== -1) {
																	newState.fontSize = Math.round(numVal * 1.5);
																}
															} else if (propName === 'letter-spacing') {
																var numVal = parseFloat(propVal);
																if (propVal.indexOf('pt') !== -1) {
																	newState.characterSpacing = Math.round(numVal * 20);
																} else if (propVal.indexOf('px') !== -1) {
																	newState.characterSpacing = Math.round(numVal * 15);
																} else {
																	newState.characterSpacing = Math.round(numVal);
																}
															} else if (propName === 'text-transform') {
																if (propVal === 'uppercase') newState.caps = true;
																else if (propVal === 'lowercase') newState.caps = false;
															} else if (propName === 'font-variant') {
																if (propVal === 'small-caps') newState.smallCaps = true;
															} else if (propName === 'vertical-align') {
																if (propVal === 'super') {
																	newState.superscript = true;
																	newState.subscript = false;
																} else if (propVal === 'sub') {
																	newState.subscript = true;
																	newState.superscript = false;
																}
															}
														}
													}
												}
											}
											stateStack.push(newState);
											formatState = newState;
										}
									} else {
										var decText = part
											.replace(/&quot;/g, '"')
											.replace(/&lt;/g, '<')
											.replace(/&gt;/g, '>')
											.replace(/&amp;/g, '&')
											.replace(/&#39;/g, "'")
											.replace(/&apos;/g, "'");
										var oRun = null;
										try { oRun = oPar.AddText(decText); } catch(eText) {}
										if (oRun) {
											if (formatState.fontName) {
												try { oRun.SetFontFamily(formatState.fontName); } catch(e) {}
												try { oRun.SetFontName(formatState.fontName); } catch(e) {}
											}
											if (formatState.fontSize) {
												try { oRun.SetFontSize(formatState.fontSize); } catch(e) {}
											}
											try { oRun.SetBold(!!formatState.bold); } catch(e) {}
											try { oRun.SetItalic(!!formatState.italic); } catch(e) {}
											try { oRun.SetUnderline(!!formatState.underline); } catch(e) {}
											try { oRun.SetStrikeout(!!formatState.strikeout); } catch(e) {}
											try { oRun.SetDoubleStrikeout(!!formatState.doubleStrikeout); } catch(e) {}
											try { oRun.SetSmallCaps(!!formatState.smallCaps); } catch(e) {}
											try { oRun.SetCaps(!!formatState.caps); } catch(e) {}
											try { oRun.SetSubscript(!!formatState.subscript); } catch(e) {}
											try { oRun.SetSuperscript(!!formatState.superscript); } catch(e) {}
											try { if (formatState.characterSpacing) oRun.SetSpacing(formatState.characterSpacing); } catch(e) {}
											if (formatState.highlight) {
												try {
													var hl = formatState.highlight.toLowerCase().trim();
													if (hl === "none" || hl === "null" || hl === "default") oRun.SetHighlight("none");
													else if (hl.indexOf("yellow") !== -1 || hl === "#ffff00") oRun.SetHighlight("yellow");
													else if (hl.indexOf("green") !== -1 || hl === "#00ff00" || hl === "#008000") oRun.SetHighlight("green");
													else if (hl.indexOf("blue") !== -1 || hl === "#0000ff") oRun.SetHighlight("blue");
													else if (hl.indexOf("cyan") !== -1 || hl.indexOf("aqua") !== -1 || hl === "#00ffff") oRun.SetHighlight("cyan");
													else if (hl.indexOf("red") !== -1 || hl === "#ff0000") oRun.SetHighlight("red");
													else if (hl.indexOf("magenta") !== -1 || hl === "#ff00ff") oRun.SetHighlight("magenta");
													else if (hl.indexOf("gray") !== -1 || hl.indexOf("grey") !== -1 || hl === "#808080") oRun.SetHighlight("lightGray");
													else oRun.SetHighlight(hl);
												} catch(eHighlight) {}
											}
											if (formatState.color) {
												try {
													var hex = String(formatState.color).replace('#', '').trim();
													if (hex.length === 6) {
														var red = parseInt(hex.substring(0, 2), 16);
														var green = parseInt(hex.substring(2, 4), 16);
														var blue = parseInt(hex.substring(4, 6), 16);
														try { oRun.SetColor(Api.CreateColorFromRGB(red, green, blue)); } catch(eColor) {
															try { oRun.SetColor(red, green, blue); } catch(errHex) {}
														}
													} else {
														var namedColors = {
															"red": [255, 0, 0], "green": [0, 128, 0], "blue": [0, 0, 255],
															"yellow": [255, 255, 0], "black": [0, 0, 0], "white": [255, 255, 255],
															"gray": [128, 128, 128], "purple": [128, 0, 128], "orange": [255, 165, 0]
														};
														if (namedColors[hex.toLowerCase()]) {
															var rgb = namedColors[hex.toLowerCase()];
															oRun.SetColor(Api.CreateColorFromRGB(rgb[0], rgb[1], rgb[2]));
														}
													}
												} catch(eColorOuter) {}
											}
										}
									}
								}
							};
							
							// Clamp index to prevent out-of-bounds target formatting references
							if (actualTargetIndex >= countBefore) {
								actualTargetIndex = countBefore - 1;
							}
							if (actualTargetIndex < 0) {
								actualTargetIndex = 0;
							}
							
							var oParagraph = oDocument.GetElement(actualTargetIndex);
							
							var origFont = "Calibri";
							var origSize = 22;
							var origBold = false;
							var origItalic = false;
							var origUnderline = false;
							var origStrikeout = false;
							var origColorHex = "#000000";
							var origHighlight = "none";
							
							if (oParagraph) {
								try {
									var runCount = oParagraph.GetElementsCount();
									if (runCount > 0) {
										var firstRun = oParagraph.GetElement(0);
										if (firstRun) {
											var textPr = null;
											try { if (typeof firstRun.GetTextPr === "function") textPr = firstRun.GetTextPr(); } catch(e) {}
											if (textPr) {
												try { 
													if (typeof textPr.GetFontName === "function") {
														origFont = textPr.GetFontName() || origFont;
													}
												} catch(e) {}
												try { if (typeof textPr.GetFontSize === "function") origSize = textPr.GetFontSize() || origSize; } catch(e) {}
												try { if (typeof textPr.GetBold === "function") origBold = textPr.GetBold() || origBold; } catch(e) {}
												try { if (typeof textPr.GetItalic === "function") origItalic = textPr.GetItalic() || origItalic; } catch(e) {}
												try { if (typeof textPr.GetUnderline === "function") origUnderline = !!textPr.GetUnderline(); } catch(e) {}
												try { if (typeof textPr.GetStrikeout === "function") origStrikeout = !!textPr.GetStrikeout(); } catch(e) {}
												try {
													if (typeof textPr.GetColor === "function") {
														var c = textPr.GetColor();
														if (c && typeof c.GetHex === "function") origColorHex = c.GetHex() || origColorHex;
													}
												} catch(e) {}
												try {
													if (typeof textPr.GetHighlight === "function") {
														var hl = textPr.GetHighlight();
														if (hl) {
															if (typeof hl === "string") origHighlight = hl;
															else if (typeof hl.GetHex === "function") origHighlight = hl.GetHex() || origHighlight;
														}
													}
												} catch(e) {}
											}
										}
									}
								} catch(e) {}
								
								try { oParagraph.Select(); } catch(e) {}
								
								var oProps = change.properties || {};
								try {
									if (oProps.newText !== undefined) {
										parseAndApplyTextWithTags(oParagraph, oProps.newText, origFont, origSize, origBold, origItalic, origUnderline, origStrikeout, origColorHex, origHighlight, oProps);
									} else {
										// Directly apply styles to existing runs without recreating/destroying them!
										var runCount = oParagraph.GetElementsCount();
										for (var r = 0; r < runCount; r++) {
											var oRun = oParagraph.GetElement(r);
											if (oRun && oRun.GetClassType() === "run") {
												if (oProps.fontName !== undefined) {
													try { oRun.SetFontFamily(oProps.fontName); } catch(e) {}
													try { oRun.SetFontName(oProps.fontName); } catch(e) {}
												}
												if (oProps.fontSize !== undefined) {
													try { oRun.SetFontSize(oProps.fontSize); } catch(e) {}
												}
												if (oProps.bold !== undefined) {
													try { oRun.SetBold(!!oProps.bold); } catch(e) {}
												}
												if (oProps.italic !== undefined) {
													try { oRun.SetItalic(!!oProps.italic); } catch(e) {}
												}
												if (oProps.underline !== undefined) {
													try { oRun.SetUnderline(!!oProps.underline); } catch(e) {}
												}
												if (oProps.strikeout !== undefined) {
													try { oRun.SetStrikeout(!!oProps.strikeout); } catch(e) {}
												}
												if (oProps.doubleStrikeout !== undefined) {
													try { oRun.SetDoubleStrikeout(!!oProps.doubleStrikeout); } catch(e) {}
												}
												if (oProps.smallCaps !== undefined) {
													try { oRun.SetSmallCaps(!!oProps.smallCaps); } catch(e) {}
												}
												if (oProps.caps !== undefined) {
													try { oRun.SetCaps(!!oProps.caps); } catch(e) {}
												}
												if (oProps.subscript !== undefined) {
													try { oRun.SetSubscript(!!oProps.subscript); } catch(e) {}
												}
												if (oProps.superscript !== undefined) {
													try { oRun.SetSuperscript(!!oProps.superscript); } catch(e) {}
												}
												if (oProps.characterSpacing !== undefined) {
													try { oRun.SetSpacing(oProps.characterSpacing); } catch(e) {}
												}
												if (oProps.highlight !== undefined) {
													try {
														var hl = oProps.highlight.toLowerCase().trim();
														if (hl === "none" || hl === "null" || hl === "default") oRun.SetHighlight("none");
														else if (hl.indexOf("yellow") !== -1 || hl === "#ffff00") oRun.SetHighlight("yellow");
														else if (hl.indexOf("green") !== -1 || hl === "#00ff00" || hl === "#008000") oRun.SetHighlight("green");
														else if (hl.indexOf("blue") !== -1 || hl === "#0000ff") oRun.SetHighlight("blue");
														else if (hl.indexOf("cyan") !== -1 || hl.indexOf("aqua") !== -1 || hl === "#00ffff") oRun.SetHighlight("cyan");
														else if (hl.indexOf("red") !== -1 || hl === "#ff0000") oRun.SetHighlight("red");
														else if (hl.indexOf("magenta") !== -1 || hl.indexOf("pink") !== -1 || hl === "#ff00ff") oRun.SetHighlight("magenta");
														else if (hl.indexOf("gray") !== -1 || hl.indexOf("grey") !== -1 || hl === "#808080") oRun.SetHighlight("lightGray");
														else oRun.SetHighlight(hl);
													} catch(eHighlight) {}
												}
												if (oProps.color !== undefined) {
													try {
														var hex = String(oProps.color).replace('#', '').trim();
														if (hex.length === 6) {
															var red = parseInt(hex.substring(0, 2), 16);
															var green = parseInt(hex.substring(2, 4), 16);
															var blue = parseInt(hex.substring(4, 6), 16);
															try { oRun.SetColor(Api.CreateColorFromRGB(red, green, blue)); } catch(eColor) {
																try { oRun.SetColor(red, green, blue); } catch(errHex) {}
															}
														} else {
															var namedColors = {
																"red": [255, 0, 0], "green": [0, 128, 0], "blue": [0, 0, 255],
																"yellow": [255, 255, 0], "black": [0, 0, 0], "white": [255, 255, 255],
																"gray": [128, 128, 128], "purple": [128, 0, 128], "orange": [255, 165, 0]
															};
															if (namedColors[hex.toLowerCase()]) {
																var rgb = namedColors[hex.toLowerCase()];
																oRun.SetColor(Api.CreateColorFromRGB(rgb[0], rgb[1], rgb[2]));
															}
														}
													} catch(eColorOuter) {}
												}
											}
										}
									}
								} catch(e) {}

								// Apply paragraph-level styling
								try {
									if (oProps.alignment) {
										var jc = oProps.alignment;
										if (jc === "justify") jc = "both";
										if (typeof oParagraph.SetJc === "function") oParagraph.SetJc(jc);
									}
								} catch(e) {}
								try {
									var oParaPr = typeof oParagraph.GetParaPr === "function" ? oParagraph.GetParaPr() : null;
									if (oParaPr) {
										if (oProps.indLeft !== undefined && typeof oParaPr.SetIndLeft === "function") {
											oParaPr.SetIndLeft(Number(oProps.indLeft));
										}
										if (oProps.indRight !== undefined && typeof oParaPr.SetIndRight === "function") {
											oParaPr.SetIndRight(Number(oProps.indRight));
										}
										if (oProps.indFirstLine !== undefined && typeof oParaPr.SetIndFirstLine === "function") {
											oParaPr.SetIndFirstLine(Number(oProps.indFirstLine));
										}
									}
								} catch(eIndent) {}
								try { if (oProps.spacingAfter !== undefined && oParagraph.SetSpacingAfter) oParagraph.SetSpacingAfter(oProps.spacingAfter); } catch(e) {}
								try { if (oProps.spacingBefore !== undefined && oParagraph.SetSpacingBefore) oParagraph.SetSpacingBefore(oProps.spacingBefore); } catch(e) {}
								try {
									if (oProps.lineSpacing !== undefined && oParagraph.SetSpacingLine) {
										var rule = oProps.lineSpacingRule || "auto";
										var val = oProps.lineSpacingTwips || Math.round(oProps.lineSpacing * 240);
										oParagraph.SetSpacingLine(val, rule);
									}
								} catch(e) {}
								try {
									if (oProps.shading !== undefined && oParagraph.SetShd) {
										var hex = String(oProps.shading).replace('#', '').trim();
										if (hex.length === 6) {
											var r = parseInt(hex.substring(0, 2), 16);
											var g = parseInt(hex.substring(2, 4), 16);
											var b = parseInt(hex.substring(4, 6), 16);
											try { oParagraph.SetShd(r, g, b); } catch(eShd) {
												try { oParagraph.SetShd(Api.CreateColorFromRGB(r, g, b)); } catch(errShd) {}
											}
										}
									}
								} catch(e) {}
							}
							return "success";
						}, false, true, function() {
							resolve({ delta: 0 });
						});
					}
				});
			}

			// Apply edit command
			const editResult = await runEditCommand();

			// Capture element state after applying change
			const afterState = await captureElementState(actualTargetIndex);

			// Verification logic check
			const verification = verifyChange(change, beforeState, afterState);

			if (verification.success) {
				log(`Action [${actionName.toUpperCase()}] executed and VERIFIED successfully!`, 'success');
				
				// Append final successful stateAfter
				lastExecutionDebugData.stateAfter.push({
					stepIndex: i,
					action: actionName,
					targetIndex: targetIndex,
					actualIndex: actualTargetIndex,
					state: afterState,
					verification: verification
				});
				if (typeof updateDebugViewer === 'function') updateDebugViewer();

				indexOffset += editResult.delta;
				retryCount = 0; 
				i++;
				setTimeout(applyNext, 300);
			} else {
				log(`Verification FAILED for action [${actionName.toUpperCase()}]: ${verification.reason}`, 'warning');
				retryCount++;
				if (retryCount < maxRetries) {
					log(`Retrying action [${actionName.toUpperCase()}] in 1000ms...`, 'info');
					setTimeout(applyNext, 1000);
				} else {
					log(`Action [${actionName.toUpperCase()}] failed verification after ${maxRetries} attempts. Proceeding anyway to preserve workflow continuity.`, 'error');
					
					// Append final fallback stateAfter
					lastExecutionDebugData.stateAfter.push({
						stepIndex: i,
						action: actionName,
						targetIndex: targetIndex,
						actualIndex: actualTargetIndex,
						state: afterState,
						verification: verification
					});
					if (typeof updateDebugViewer === 'function') updateDebugViewer();

					indexOffset += editResult.delta;
					retryCount = 0; 
					i++;
					setTimeout(applyNext, 300);
				}
			}
			} catch (err) {
				log(`Error executing autonomous edits at step ${i}: ${err.message}`, 'error');
				setStepperStep(3, "failed", err.message);
				isEditingAutonomously = false;
				executeBtn.disabled = false;
				proposedChanges = null;
			}
		}

		// HTML Tag Parser
		function parseAndApplyTextWithTags(oPar, htmlStr, defFont, defSize, defBold, defItalic, defUnderline, defStrikeout, defColorHex, defHighlight, pProps) {
			try { oPar.RemoveAllElements(); } catch(e) {}
			if (htmlStr) {
				htmlStr = htmlStr
					.replace(/\*\*(.*?)\*\*/g, '<b>$1</b>')
					.replace(/__(.*?)__/g, '<b>$1</b>')
					.replace(/\*(.*?)\*/g, '<i>$1</i>')
					.replace(/_(.*?)_/g, '<i>$1</i>');
			}
			var regex = /(<[^>]+>)/g;
			var parts = String(htmlStr || "").split(regex);
			var formatState = {
				fontName: pProps.fontName || defFont || "Calibri",
				fontSize: pProps.fontSize || defSize || 22,
				bold: pProps.bold !== undefined ? pProps.bold : (defBold !== undefined ? defBold : false),
				italic: pProps.italic !== undefined ? pProps.italic : (defItalic !== undefined ? defItalic : false),
				underline: pProps.underline !== undefined ? pProps.underline : (defUnderline !== undefined ? defUnderline : false),
				strikeout: pProps.strikeout !== undefined ? pProps.strikeout : (defStrikeout !== undefined ? defStrikeout : false),
				doubleStrikeout: pProps.doubleStrikeout !== undefined ? pProps.doubleStrikeout : false,
				smallCaps: pProps.smallCaps !== undefined ? pProps.smallCaps : false,
				caps: pProps.caps !== undefined ? pProps.caps : false,
				subscript: pProps.subscript !== undefined ? pProps.subscript : false,
				superscript: pProps.superscript !== undefined ? pProps.superscript : false,
				characterSpacing: pProps.characterSpacing !== undefined ? pProps.characterSpacing : 0,
				color: pProps.color || defColorHex || "#000000",
				highlight: pProps.highlight || defHighlight || "none"
			};

			if (!htmlStr) {
				// For empty strings, generate a single empty run to capture formatting properties
				var oRun = null;
				try { oRun = oPar.AddText(""); } catch(eText) {}
				if (oRun) {
					if (formatState.fontName) {
						try { oRun.SetFontFamily(formatState.fontName); } catch(e) {}
						try { oRun.SetFontName(formatState.fontName); } catch(e) {}
					}
					if (formatState.fontSize) {
						try { oRun.SetFontSize(formatState.fontSize); } catch(e) {}
					}
					try { oRun.SetBold(!!formatState.bold); } catch(e) {}
					try { oRun.SetItalic(!!formatState.italic); } catch(e) {}
					try { oRun.SetUnderline(!!formatState.underline); } catch(e) {}
					try { oRun.SetStrikeout(!!formatState.strikeout); } catch(e) {}
					try { oRun.SetDoubleStrikeout(!!formatState.doubleStrikeout); } catch(e) {}
					try { oRun.SetSmallCaps(!!formatState.smallCaps); } catch(e) {}
					try { oRun.SetCaps(!!formatState.caps); } catch(e) {}
					try { oRun.SetSubscript(!!formatState.subscript); } catch(e) {}
					try { oRun.SetSuperscript(!!formatState.superscript); } catch(e) {}
					try { if (formatState.characterSpacing) oRun.SetSpacing(formatState.characterSpacing); } catch(e) {}
					
					if (formatState.highlight) {
						try {
							var hl = formatState.highlight.toLowerCase().trim();
							if (hl === "none" || hl === "null" || hl === "default") oRun.SetHighlight("none");
							else if (hl.indexOf("yellow") !== -1 || hl === "#ffff00") oRun.SetHighlight("yellow");
							else if (hl.indexOf("green") !== -1 || hl === "#00ff00" || hl === "#008000") oRun.SetHighlight("green");
							else if (hl.indexOf("blue") !== -1 || hl === "#0000ff") oRun.SetHighlight("blue");
							else if (hl.indexOf("cyan") !== -1 || hl.indexOf("aqua") !== -1 || hl === "#00ffff") oRun.SetHighlight("cyan");
							else if (hl.indexOf("red") !== -1 || hl === "#ff0000") oRun.SetHighlight("red");
							else if (hl.indexOf("magenta") !== -1 || hl.indexOf("pink") !== -1 || hl === "#ff00ff") oRun.SetHighlight("magenta");
							else if (hl.indexOf("gray") !== -1 || hl.indexOf("grey") !== -1 || hl === "#808080") oRun.SetHighlight("lightGray");
							else oRun.SetHighlight(hl);
						} catch(eHighlight) {}
					}
					
					if (formatState.color) {
						try {
							var hex = String(formatState.color).replace('#', '').trim();
							if (hex.length === 6) {
								var red = parseInt(hex.substring(0, 2), 16);
								var green = parseInt(hex.substring(2, 4), 16);
								var blue = parseInt(hex.substring(4, 6), 16);
								try { oRun.SetColor(Api.CreateColorFromRGB(red, green, blue)); } catch(eColor) {
									try { oRun.SetColor(red, green, blue); } catch(errHex) {}
								}
							}
						} catch(eColorOuter) {}
					}
				}
				return;
			}

			var stateStack = [JSON.parse(JSON.stringify(formatState))];
			
			for (var idx = 0; idx < parts.length; idx++) {
				var part = parts[idx];
				if (!part) continue;
				
				if (part.charAt(0) === '<' && part.charAt(part.length - 1) === '>') {
					var tagLower = part.toLowerCase();
					if (tagLower.indexOf("</") === 0) {
						if (stateStack.length > 1) {
							stateStack.pop();
							formatState = JSON.parse(JSON.stringify(stateStack[stateStack.length - 1]));
						}
					} else {
						var newState = JSON.parse(JSON.stringify(formatState));
						if (tagLower.indexOf("<b") === 0 || tagLower.indexOf("<strong") === 0) {
							newState.bold = true;
						} else if (tagLower.indexOf("<i") === 0 || tagLower.indexOf("<em") === 0) {
							newState.italic = true;
						} else if (tagLower.indexOf("<u") === 0) {
							newState.underline = true;
						} else if (tagLower.indexOf("<strike") === 0 || tagLower.indexOf("<del") === 0 || tagLower.indexOf("<s") === 0) {
							newState.strikeout = true;
						} else if (tagLower.indexOf("<sub>") === 0) {
							newState.subscript = true;
							newState.superscript = false;
						} else if (tagLower.indexOf("<sup>") === 0) {
							newState.superscript = true;
							newState.subscript = false;
						} else if (tagLower.indexOf("<small>") === 0) {
							newState.smallCaps = true;
						} else if (tagLower.indexOf("<big>") === 0) {
							newState.caps = true;
							newState.fontSize = Math.round(newState.fontSize * 1.2);
						} else if (tagLower.indexOf("<font") === 0) {
							var match = part.match(/color=["']([^"']+)["']/i);
							if (match && match[1]) newState.color = match[1];
							var matchFace = part.match(/face=["']([^"']+)["']/i);
							if (matchFace && matchFace[1]) newState.fontName = matchFace[1];
							var matchSize = part.match(/size=["']([^"']+)["']/i);
							if (matchSize && matchSize[1]) newState.fontSize = parseFloat(matchSize[1]);
						} else if (tagLower.indexOf("<mark") === 0) {
							var match = part.match(/color=["']([^"']+)["']/i);
							var styleMatch = part.match(/style=["']([^"']+)["']/i);
							if (match && match[1]) {
								newState.highlight = match[1];
							} else if (styleMatch && styleMatch[1]) {
								var styleStr = styleMatch[1];
								var declarations = styleStr.split(';');
								var foundBg = false;
								for (var d = 0; d < declarations.length; d++) {
									var dec = declarations[d].trim();
									if (!dec) continue;
									var pSplit = dec.split(':');
									if (pSplit.length >= 2) {
										var propName = pSplit[0].trim().toLowerCase();
										var propVal = pSplit.slice(1).join(':').trim().toLowerCase();
										if (propName === 'background-color' || propName === 'background' || propName === 'color') {
											newState.highlight = propVal;
											foundBg = true;
										}
									}
								}
								if (!foundBg) newState.highlight = "yellow";
							} else {
								newState.highlight = "yellow";
							}
						} else if (tagLower.indexOf("<span") === 0) {
							var styleMatch = part.match(/style=["']([^"']+)["']/i);
							if (styleMatch && styleMatch[1]) {
								var styleStr = styleMatch[1];
								var declarations = styleStr.split(';');
								for (var d = 0; d < declarations.length; d++) {
									var dec = declarations[d].trim();
									if (!dec) continue;
									var pSplit = dec.split(':');
									if (pSplit.length >= 2) {
										var propName = pSplit[0].trim().toLowerCase();
										var propVal = pSplit.slice(1).join(':').trim().toLowerCase();
										
										if (propName === 'font-weight') {
											if (propVal === 'bold' || propVal === '700' || propVal === '800' || propVal === '900') newState.bold = true;
											else if (propVal === 'normal' || propVal === '400') newState.bold = false;
										} else if (propName === 'font-style') {
											if (propVal === 'italic' || propVal === 'oblique') newState.italic = true;
											else if (propVal === 'normal') newState.italic = false;
										} else if (propName === 'text-decoration') {
											if (propVal.indexOf('underline') !== -1) newState.underline = true;
											if (propVal.indexOf('line-through') !== -1) newState.strikeout = true;
											if (propVal.indexOf('double-line-through') !== -1 || propVal.indexOf('double') !== -1) newState.doubleStrikeout = true;
										} else if (propName === 'color') {
											newState.color = propVal;
										} else if (propName === 'background-color' || propName === 'background') {
											newState.highlight = propVal;
										} else if (propName === 'font-family') {
											newState.fontName = propVal.replace(/['"]/g, '').trim();
										} else if (propName === 'font-size') {
											var numVal = parseFloat(propVal);
											if (propVal.indexOf('pt') !== -1) {
												newState.fontSize = Math.round(numVal * 2);
											} else if (propVal.indexOf('px') !== -1) {
												newState.fontSize = Math.round(numVal * 1.5);
											}
										} else if (propName === 'letter-spacing') {
											var numVal = parseFloat(propVal);
											if (propVal.indexOf('pt') !== -1) {
												newState.characterSpacing = Math.round(numVal * 20);
											} else if (propVal.indexOf('px') !== -1) {
												newState.characterSpacing = Math.round(numVal * 15);
											} else {
												newState.characterSpacing = Math.round(numVal);
											}
										} else if (propName === 'text-transform') {
											if (propVal === 'uppercase') newState.caps = true;
											else if (propVal === 'lowercase') newState.caps = false;
										} else if (propName === 'font-variant') {
											if (propVal === 'small-caps') newState.smallCaps = true;
										} else if (propName === 'vertical-align') {
											if (propVal === 'super') {
												newState.superscript = true;
												newState.subscript = false;
											} else if (propVal === 'sub') {
												newState.subscript = true;
												newState.superscript = false;
											}
										}
									}
								}
							}
						}
						stateStack.push(newState);
						formatState = newState;
					}
				} else {
					var decText = part
						.replace(/&quot;/g, '"')
						.replace(/&lt;/g, '<')
						.replace(/&gt;/g, '>')
						.replace(/&amp;/g, '&')
						.replace(/&#39;/g, "'")
						.replace(/&apos;/g, "'");
						
					var oRun = null;
					try { oRun = oPar.AddText(decText); } catch(eText) {}
					if (oRun) {
						if (formatState.fontName) {
							try { oRun.SetFontFamily(formatState.fontName); } catch(e) {}
							try { oRun.SetFontName(formatState.fontName); } catch(e) {}
						}
						if (formatState.fontSize) {
							try { oRun.SetFontSize(formatState.fontSize); } catch(e) {}
						}
						try { oRun.SetBold(!!formatState.bold); } catch(e) {}
						try { oRun.SetItalic(!!formatState.italic); } catch(e) {}
						try { oRun.SetUnderline(!!formatState.underline); } catch(e) {}
						try { oRun.SetStrikeout(!!formatState.strikeout); } catch(e) {}
						try { oRun.SetDoubleStrikeout(!!formatState.doubleStrikeout); } catch(e) {}
						try { oRun.SetSmallCaps(!!formatState.smallCaps); } catch(e) {}
						try { oRun.SetCaps(!!formatState.caps); } catch(e) {}
						try { oRun.SetSubscript(!!formatState.subscript); } catch(e) {}
						try { oRun.SetSuperscript(!!formatState.superscript); } catch(e) {}
						try { if (formatState.characterSpacing) oRun.SetSpacing(formatState.characterSpacing); } catch(e) {}
						
						if (formatState.highlight) {
							try {
								var hl = formatState.highlight.toLowerCase().trim();
								if (hl === "none" || hl === "null" || hl === "default") oRun.SetHighlight("none");
								else if (hl.indexOf("yellow") !== -1 || hl === "#ffff00") oRun.SetHighlight("yellow");
								else if (hl.indexOf("green") !== -1 || hl === "#00ff00" || hl === "#008000") oRun.SetHighlight("green");
								else if (hl.indexOf("blue") !== -1 || hl === "#0000ff") oRun.SetHighlight("blue");
								else if (hl.indexOf("cyan") !== -1 || hl.indexOf("aqua") !== -1 || hl === "#00ffff") oRun.SetHighlight("cyan");
								else if (hl.indexOf("red") !== -1 || hl === "#ff0000") oRun.SetHighlight("red");
								else if (hl.indexOf("magenta") !== -1 || hl.indexOf("pink") !== -1 || hl === "#ff00ff") oRun.SetHighlight("magenta");
								else if (hl.indexOf("gray") !== -1 || hl.indexOf("grey") !== -1 || hl === "#808080") oRun.SetHighlight("lightGray");
								else oRun.SetHighlight(hl);
							} catch(eHighlight) {}
						}
						
						if (formatState.color) {
							try {
								var hex = String(formatState.color).replace('#', '').trim();
								if (hex.length === 6) {
									var r = parseInt(hex.substring(0, 2), 16);
									var g = parseInt(hex.substring(2, 4), 16);
									var b = parseInt(hex.substring(4, 6), 16);
									try { oRun.SetColor(Api.CreateColorFromRGB(r, g, b)); } catch(eColor) {
										try { oRun.SetColor(r, g, b); } catch(errHex) {}
									}
								} else {
									var namedColors = {
										"red": [255, 0, 0], "green": [0, 128, 0], "blue": [0, 0, 255],
										"yellow": [255, 255, 0], "black": [0, 0, 0], "white": [255, 255, 255],
										"gray": [128, 128, 128], "purple": [128, 0, 128], "orange": [255, 165, 0]
									};
									if (namedColors[hex.toLowerCase()]) {
										var rgb = namedColors[hex.toLowerCase()];
										oRun.SetColor(Api.CreateColorFromRGB(rgb[0], rgb[1], rgb[2]));
									}
								}
							} catch(eColorOuter) {}
						}
					}
				}
			}
		}

		applyNext();
	}

})(window);
