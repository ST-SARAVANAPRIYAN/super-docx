(function(window, undefined) {

	// Cache UI selectors
	const tabPrompt = document.getElementById('tab-prompt');
	const tabSettings = document.getElementById('tab-settings');
	const viewPrompt = document.getElementById('view-prompt');
	const viewSettings = document.getElementById('view-settings');

	const apiKeyInput = document.getElementById('api-key');
	const toggleKeyVisibility = document.getElementById('toggle-key-visibility');
	const saveKeyBtn = document.getElementById('save-key-btn');
	const removeKeyBtn = document.getElementById('remove-key-btn');

	const modelSelect = document.getElementById('model-select');
	const promptInput = document.getElementById('prompt-input');
	const executeBtn = document.getElementById('execute-btn');
	const logContainer = document.getElementById('log-container');
	const clearLogsBtn = document.getElementById('clear-logs');
	
	const changesCard = document.getElementById('changes-card');
	const changesList = document.getElementById('changes-list');
	const confirmBtn = document.getElementById('confirm-btn');

	let cachedDocData = null;
	let proposedChanges = null;

	// View Tabs Navigation
	tabPrompt.addEventListener('click', () => {
		tabPrompt.classList.add('active');
		tabSettings.classList.remove('active');
		viewPrompt.classList.add('active');
		viewSettings.classList.remove('active');
	});

	tabSettings.addEventListener('click', () => {
		tabSettings.classList.add('active');
		tabPrompt.classList.remove('active');
		viewSettings.classList.add('active');
		viewPrompt.classList.remove('active');
	});

	// API Key Visibility Toggle
	toggleKeyVisibility.addEventListener('click', () => {
		if (apiKeyInput.type === 'password') {
			apiKeyInput.type = 'text';
			toggleKeyVisibility.innerText = '🙈';
		} else {
			apiKeyInput.type = 'password';
			toggleKeyVisibility.innerText = '👁️';
		}
	});

	// Load Saved Settings from localStorage
	function loadSettings() {
		const savedKey = localStorage.getItem('groq_copilot_key');
		const savedModel = localStorage.getItem('groq_copilot_model');

		if (savedKey) {
			apiKeyInput.value = savedKey;
			log('Saved Groq API Key loaded securely.', 'success');
		} else {
			log('No API Key found. Go to Settings tab to add one.', 'warning');
		}

		if (savedModel) {
			modelSelect.value = savedModel;
		}
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

	// Save Model Choice on select
	modelSelect.addEventListener('change', () => {
		localStorage.setItem('groq_copilot_model', modelSelect.value);
		log(`Model switched to ${modelSelect.value}`, 'info');
	});

	// Suggestion Chips handler
	document.querySelectorAll('.chip').forEach(chip => {
		chip.addEventListener('click', () => {
			promptInput.value = chip.getAttribute('data-prompt');
			promptInput.focus();
		});
	});

	// Clear Logs
	clearLogsBtn.addEventListener('click', () => {
		logContainer.innerHTML = '';
		log('Developer logs cleared.', 'info');
	});

	// Logger helper
	function log(message, type = 'default') {
		const entry = document.createElement('div');
		entry.className = `log-entry ${type}`;
		entry.innerHTML = `<span>[${new Date().toLocaleTimeString()}]</span> <span>${message}</span>`;
		logContainer.appendChild(entry);
		logContainer.scrollTop = logContainer.scrollHeight;
	}

	// Initialize ONLYOFFICE plugin hooks
	window.Asc.plugin.init = function() {
		log('Groq AI Copilot v2 core initialized.', 'success');
		loadSettings();

		// Click run button
		executeBtn.addEventListener('click', async () => {
			const apiKey = apiKeyInput.value.trim();
			const prompt = promptInput.value.trim();

			if (!apiKey) {
				log('Error: Groq API Key is not configured. Add it in Settings.', 'error');
				tabSettings.click();
				return;
			}
			if (!prompt) {
				log('Error: Prompt cannot be empty.', 'error');
				return;
			}

			setLoading(true);
			log('Scanning active document structure, headings, and elements...', 'info');

			try {
				// Step 1: Read/Serialize Document from ONLYOFFICE
				const docJSON = await serializeDocument();
				cachedDocData = JSON.parse(docJSON);
				
				log(`Successfully scanned ${cachedDocData.length} paragraphs.`, 'success');
				log(`Document sample structure compiled successfully. Payload characters: ${docJSON.length}`, 'info');

				// Step 2: Query Groq completions API
				log(`Contacting Groq endpoint [api.groq.com/openai/v1] using model: ${modelSelect.value}...`, 'info');
				const aiResponse = await queryGroqAPI(apiKey, modelSelect.value, cachedDocData, prompt);
				
				log('Received secure API response from Groq.', 'success');
				log(`Raw JSON response: ${aiResponse.substring(0, 150)}...`, 'info');

				// Step 3: Parse and preview the returned changes
				proposedChanges = parseAIResponse(aiResponse);
				
				if (!proposedChanges || proposedChanges.length === 0) {
					log('Analysis complete: No style or content changes suggested for this request.', 'warning');
					changesCard.style.display = 'none';
				} else {
					log(`Successfully decoded ${proposedChanges.length} autonomous formatting instructions.`, 'success');
					renderPreview(proposedChanges);
				}

			} catch (err) {
				log(`Execution Error: ${err.message}`, 'error');
				console.error(err);
			} finally {
				setLoading(false);
			}
		});

		// Confirm button click - executes sequentially and animated
		confirmBtn.addEventListener('click', () => {
			if (!proposedChanges || proposedChanges.length === 0) return;
			
			log('Starting animated autonomous editing workflow...', 'info');
			changesCard.style.display = 'none';
			executeSequentialEdits(proposedChanges);
		});
	};

	window.Asc.plugin.button = function(id) {
		this.executeCommand("close", "");
	};

	function setLoading(loading) {
		if (loading) {
			executeBtn.classList.add('loading');
			executeBtn.disabled = true;
			changesCard.style.display = 'none';
		} else {
			executeBtn.classList.remove('loading');
			executeBtn.disabled = false;
		}
	}

	// Document serialization
	function serializeDocument() {
		return new Promise((resolve, reject) => {
			// Defensive timeout to prevent UI hanging if callCommand fails
			const failTimeout = setTimeout(() => {
				reject(new Error("Document scanning timed out. ONLYOFFICE sandbox did not respond."));
			}, 4000);

			window.Asc.plugin.callCommand(function() {
				var oDocument = Api.GetDocument();
				var aParagraphs = oDocument.GetAllParagraphs();
				var aData = [];
				var limit = Math.min(aParagraphs.length, 60);
				
				for (var i = 0; i < limit; i++) {
					try {
						var oParagraph = aParagraphs[i];
						if (!oParagraph) continue;

						var oText = "";
						try { oText = oParagraph.GetText() || ""; } catch(e) {}

						// Fallback defaults
						var oFontName = "Calibri";
						var oFontSize = 22; // 11pt in half-points
						var oBold = false;
						var oItalic = false;
						var oColor = "#000000";

						// Extract styling from runs inside the paragraph elements list
						try {
							var aRuns = oParagraph.GetElements();
							if (aRuns && aRuns.length > 0) {
								for (var r = 0; r < aRuns.length; r++) {
									var oRun = aRuns[r];
									if (oRun) {
										// Safe property fetches
										if (oRun.GetFontName) oFontName = oRun.GetFontName() || oFontName;
										if (oRun.GetFontSize) oFontSize = oRun.GetFontSize() || oFontSize;
										if (oRun.GetBold) oBold = oRun.GetBold() || oBold;
										if (oRun.GetItalic) oItalic = oRun.GetItalic() || oItalic;
										if (oRun.GetColor) {
											var c = oRun.GetColor();
											if (c && c.GetHex) {
												var hexVal = c.GetHex();
												if (hexVal) oColor = hexVal;
											}
										}
										break; // Parse first style representation run
									}
								}
							}
						} catch(errRun) {}

						// Paragraph spacing & alignment
						var oAlign = "left";
						try { oAlign = oParagraph.GetJustification() || "left"; } catch(e) {}

						var oSpaceAfter = 0;
						try { oSpaceAfter = oParagraph.GetSpacingAfter() || 0; } catch(e) {}

						aData.push({
							index: i,
							text: oText,
							style: {
								fontName: oFontName,
								fontSize: oFontSize / 2, // Standardize to human points (e.g. 11pt instead of 22 half-points)
								bold: oBold,
								italic: oItalic,
								alignment: oAlign,
								color: oColor,
								spacingAfter: oSpaceAfter
							}
						});
					} catch (pErr) {
						// Continue gracefully
					}
				}
				return JSON.stringify(aData);
			}, false, true, function(result) {
				clearTimeout(failTimeout);
				if (result) {
					resolve(result);
				} else {
					reject(new Error("Unable to read document contents."));
				}
			});
		});
	}

	// Query Groq API with robust schema
	async function queryGroqAPI(apiKey, model, docData, prompt) {
		const systemMessage = `You are a professional document typesetter and layout agent. Your task is to analyze the provided JSON representation of a document and generate the requested style or content changes as a valid JSON object.
		
You must output a JSON object containing a "changes" key which holds an array of edit commands. Each edit command must have the following structure:
{
  "changes": [
    {
      "action": "modifyStyle",
      "targetIndex": 0,
      "properties": {
        "fontName": "Arial",
        "fontSize": 24,
        "bold": true,
        "italic": false,
        "color": "#1d4ed8",
        "alignment": "center",
        "spacingAfter": 120,
        "newText": "optional updated paragraph text"
      }
    }
  ]
}

Available actions:
- "modifyStyle": Set fonts, size, spacing, bold, alignment, color, or text updates.
- "createParagraph": Create a new paragraph after the targetIndex.
- "deleteParagraph": Remove this paragraph from the document.

Formatting & units specifications:
- "fontName" (string, e.g. "Arial", "Georgia", "Inter", "Times New Roman", "Courier New")
- "fontSize" (integer): Must be in half-points (e.g., 22 for 11pt, 24 for 12pt, 28 for 14pt, 32 for 16pt, 48 for 24pt). The input document represents size in standard points, but you MUST write changes in half-points.
- "bold" (boolean)
- "italic" (boolean)
- "color" (string hex code like "#1d4ed8" or "#ffff00")
- "alignment" (string: "left", "right", "center", "justify")
- "spacingAfter" (integer, in dxa: 120 = 6pt, 240 = 12pt, 360 = 18pt)
- "newText" (string, optional - only provide if content change or rewriting was requested by prompt)

If the user wants a global change (e.g. "change the entire font color to red", or "make everything Times New Roman"), you MUST generate "modifyStyle" commands for EVERY single paragraph index in the document.
Respond ONLY with a valid JSON object. Do not include markdown code block formatting (like \`\`\`json).`;

		const userMessage = `Current Document Structure:
${JSON.stringify(docData, null, 2)}

User Request:
"${prompt}"`;

		const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
			method: 'POST',
			headers: {
				'Authorization': `Bearer ${apiKey}`,
				'Content-Type': 'application/json'
			},
			body: JSON.stringify({
				model: model,
				messages: [
					{ role: 'system', content: systemMessage },
					{ role: 'user', content: userMessage }
				],
				temperature: 0.1,
				response_format: { type: 'json_object' }
			})
		});

		if (!response.ok) {
			const errorData = await response.json().catch(() => ({}));
			throw new Error(errorData.error?.message || `HTTP ${response.status}`);
		}

		const data = await response.json();
		return data.choices[0].message.content;
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
			} else if (parsed.changes && Array.isArray(parsed.changes)) {
				return parsed.changes;
			} else if (parsed.commands && Array.isArray(parsed.commands)) {
				return parsed.commands;
			} else if (typeof parsed === 'object' && parsed !== null) {
				return [parsed];
			}
			
			return [];
		} catch (e) {
			throw new Error("Could not parse a valid JSON action script from the AI's response.");
		}
	}

	// Render preview list
	function renderPreview(changes) {
		changesList.innerHTML = '';
		
		changes.forEach(change => {
			const original = cachedDocData.find(p => p.index === change.targetIndex);
			if (!original && change.action !== 'createParagraph') return;

			const item = document.createElement('div');
			item.className = 'review-item';

			let actionBadge = '';
			if (change.action === 'createParagraph') {
				actionBadge = '<span class="badge-action action-create">Create</span>';
			} else if (change.action === 'deleteParagraph') {
				actionBadge = '<span class="badge-action action-delete">Delete</span>';
			} else {
				actionBadge = '<span class="badge-action action-modify">Modify</span>';
			}

			let formatStr = '';
			const props = change.properties || {};
			if (props.fontName) formatStr += `Font: <b>${props.fontName}</b>; `;
			if (props.fontSize) formatStr += `Size: <b>${props.fontSize/2}pt</b>; `;
			if (props.bold !== undefined) formatStr += props.bold ? '<b>Bold</b>; ' : 'Regular; ';
			if (props.italic !== undefined) formatStr += props.italic ? '<i>Italic</i>; ' : 'No Italic; ';
			if (props.alignment) formatStr += `Align: <b>${props.alignment}</b>; `;
			if (props.color) formatStr += `Color: <span style="color: ${props.color}; font-weight: bold;">${props.color}</span>; `;

			item.innerHTML = `
				${actionBadge}
				<div style="font-weight: 600; margin-bottom: 2px;">Paragraph #${change.targetIndex + 1}</div>
				${original ? `<div style="color: var(--text-secondary); margin-bottom: 4px; font-style: italic;">"${original.text.substring(0, 50)}${original.text.length > 50 ? '...' : ''}"</div>` : ''}
				${props.newText && original ? `
					<div class="diff-original">"${original.text}"</div>
					<div class="diff-new">"${props.newText}"</div>
				` : ''}
				${props.newText && change.action === 'createParagraph' ? `
					<div class="diff-new" style="margin-top: 4px;">+ "${props.newText}"</div>
				` : ''}
				${formatStr ? `<div style="font-size: 10.5px; color: var(--primary); margin-top: 4px;">Style => ${formatStr}</div>` : ''}
			`;
			changesList.appendChild(item);
		});

		changesCard.style.display = 'block';
	}

	// Sequential, Animated, Interactive execution engine
	function executeSequentialEdits(changes) {
		let i = 0;
		
		function applyNext() {
			if (i >= changes.length) {
				log('All autonomous AI edits applied live and completed!', 'success');
				proposedChanges = null;
				return;
			}

			const change = changes[i];
			const actionName = change.action || 'modifyStyle';
			
			if (actionName === 'deleteParagraph') {
				log(`Executing Action: [Delete] Paragraph #${change.targetIndex + 1}...`, 'warning');
			} else if (actionName === 'createParagraph') {
				log(`Executing Action: [Create] New Paragraph after #${change.targetIndex + 1}...`, 'success');
			} else {
				log(`Executing Action: [Formatting] Paragraph #${change.targetIndex + 1}...`, 'info');
			}

			// Pass variable to sandboxed callCommand through ONLYOFFICE scope object
			window.Asc.scope.change = change;

			window.Asc.plugin.callCommand(function() {
				var change = Asc.scope.change;
				var oDocument = Api.GetDocument();
				var aParagraphs = oDocument.GetAllParagraphs();
				var oParagraph = aParagraphs[change.targetIndex];
				
				if (oParagraph) {
					try {
						// Focus/Scroll to active paragraph
						oParagraph.Select();
					} catch(e) {}
					
					var oProps = change.properties || {};
					
					if (change.action === 'deleteParagraph') {
						try { oParagraph.Delete(); } catch(e) {}
						return "deleted";
					}
					
					if (change.action === 'createParagraph') {
						try {
							var oNewParagraph = Api.CreateParagraph();
							if (oProps.newText) {
								oNewParagraph.AddText(oProps.newText);
							}
							oParagraph.InsertAfter(oNewParagraph);
							oParagraph = oNewParagraph;
							oNewParagraph.Select();
						} catch(e) {}
					}

					// Safe text rewrite using ReplaceTextSmart on selection
					try {
						if (oProps.newText !== undefined && change.action !== 'createParagraph') {
							Api.ReplaceTextSmart([oProps.newText]);
						}
					} catch(e) {}

					// Apply styling directly on the selected Range (Run/Inline level)
					try {
						var oRange = oDocument.GetRangeBySelect();
						if (oRange) {
							if (oProps.fontName) oRange.SetFontName(oProps.fontName);
							if (oProps.fontSize) oRange.SetFontSize(oProps.fontSize);
							if (oProps.bold !== undefined) oRange.SetBold(oProps.bold);
							if (oProps.italic !== undefined) oRange.SetItalic(oProps.italic);
							
							// Safe color parser
							if (oProps.color) {
								var hex = oProps.color.replace('#', '');
								if (hex.length === 6) {
									var r = parseInt(hex.substring(0, 2), 16);
									var g = parseInt(hex.substring(2, 4), 16);
									var b = parseInt(hex.substring(4, 6), 16);
									try {
										oRange.SetColor(Api.CreateColorFromRGB(r, g, b));
									} catch(eColor) {
										try {
											oRange.SetColor(r, g, b);
										} catch(errHex) {}
									}
								}
							}
						}
					} catch(e) {}

					// Apply paragraph-level styling
					try { if (oProps.alignment) oParagraph.SetJustification(oProps.alignment); } catch(e) {}
					try { if (oProps.spacingAfter !== undefined) oParagraph.SetSpacingAfter(oProps.spacingAfter); } catch(e) {}
				}
				return "success";
			}, false, true, function(result) {
				i++;
				setTimeout(applyNext, 500);
			});
		}

		applyNext();
	}

})(window);
