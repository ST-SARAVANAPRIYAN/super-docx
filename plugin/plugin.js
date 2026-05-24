(function(window, undefined) {

	// Cache UI selectors
	const tabPrompt = document.getElementById('tab-prompt');
	const tabStructure = document.getElementById('tab-structure');
	const tabSettings = document.getElementById('tab-settings');
	
	const viewPrompt = document.getElementById('view-prompt');
	const viewStructure = document.getElementById('view-structure');
	const viewSettings = document.getElementById('view-settings');
	
	const structureJson = document.getElementById('structure-json');
	const copyStructure = document.getElementById('copy-structure');
	const refreshStructure = document.getElementById('refresh-structure');

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

	// Undo / Redo selectors
	const toolbarUndo = document.getElementById('toolbar-undo');
	const toolbarRedo = document.getElementById('toolbar-redo');

	// Scan Range selectors
	const rangeFull = document.getElementById('range-full');
	const rangeSelect = document.getElementById('range-select');
	let scanRange = 'full'; // 'full' or 'select'

	// Summarization elements
	const chipSummarize = document.getElementById('chip-summarize');
	const summaryCard = document.getElementById('summary-card');
	const summaryText = document.getElementById('summary-text');
	const insertSummaryBtn = document.getElementById('insert-summary-btn');
	let activeSummaryContent = '';

	// Session Checkpoints elements
	const saveCheckpointBtn = document.getElementById('save-checkpoint-btn');
	const checkpointsList = document.getElementById('checkpoints-list');

	let cachedDocData = null;
	let proposedChanges = null;
	let checkpoints = [];

	// View Tabs Navigation
	tabPrompt.addEventListener('click', () => {
		tabPrompt.classList.add('active');
		tabStructure.classList.remove('active');
		tabSettings.classList.remove('active');
		viewPrompt.classList.add('active');
		viewStructure.classList.remove('active');
		viewSettings.classList.remove('active');
	});

	tabStructure.addEventListener('click', () => {
		tabStructure.classList.add('active');
		tabPrompt.classList.remove('active');
		tabSettings.classList.remove('active');
		viewStructure.classList.add('active');
		viewPrompt.classList.remove('active');
		viewSettings.classList.remove('active');
		refreshDocStructureView();
	});

	tabSettings.addEventListener('click', () => {
		tabSettings.classList.add('active');
		tabPrompt.classList.remove('active');
		tabStructure.classList.remove('active');
		viewSettings.classList.add('active');
		viewPrompt.classList.remove('active');
		viewStructure.classList.remove('active');
		renderCheckpointsUI();
	});

	// Range selectors events
	rangeFull.addEventListener('click', () => {
		rangeFull.classList.add('active');
		rangeSelect.classList.remove('active');
		scanRange = 'full';
		log("Scan range set to: Entire Document.", "info");
	});

	rangeSelect.addEventListener('click', () => {
		rangeSelect.classList.add('active');
		rangeFull.classList.remove('active');
		scanRange = 'select';
		log("Scan range set to: User Selection Only.", "info");
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
			if (savedModel === 'mixtral-8x7b-32768') {
				modelSelect.value = 'llama-3.3-70b-versatile';
				localStorage.setItem('groq_copilot_model', 'llama-3.3-70b-versatile');
			} else {
				modelSelect.value = savedModel;
			}
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
		if (chip.id === 'chip-summarize') return; // Skip special chip
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

	// Dynamic Document JSON Viewer compiler
	async function refreshDocStructureView() {
		structureJson.value = "Scanning active document structure JSON...";
		try {
			let docJSON = "";
			if (scanRange === "select") {
				docJSON = await serializeSelection();
			} else {
				docJSON = await serializeDocument();
			}
			const parsed = JSON.parse(docJSON);
			structureJson.value = JSON.stringify(parsed, null, 2);
			log("Compiled structural document JSON successfully.", "success");
		} catch(err) {
			structureJson.value = "Error scanning document structure: " + err.message;
			log("Error loading structure: " + err.message, "error");
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

	// Session Checkpoint Snapshots
	saveCheckpointBtn.addEventListener('click', () => {
		saveCheckpoint();
	});

	async function saveCheckpoint() {
		log("Capturing active document snapshot...", "info");
		try {
			const docJSON = await serializeDocument();
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

	function renderCheckpointsUI() {
		if (checkpoints.length === 0) {
			checkpointsList.innerHTML = `<div style="font-size: 11px; color: var(--text-secondary); text-align: center; padding: 8px;">No checkpoints saved yet.</div>`;
			return;
		}
		checkpointsList.innerHTML = '';
		checkpoints.forEach((cp, index) => {
			const item = document.createElement('div');
			item.className = 'checkpoint-item';
			item.innerHTML = `
				<span>Snapshot #${index + 1} (${cp.timestamp})</span>
				<button class="checkpoint-restore-btn" data-index="${index}">Restore</button>
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
		log(`Restoring document state to Snapshot #${index + 1}...`, 'info');
		
		let restoreChanges = [];
		cp.data.sections.forEach(s => {
			s.elements.forEach(el => {
				if (el.type === "paragraph" && el.text) {
					restoreChanges.push({
						action: "modifyStyle",
						targetIndex: el.index,
						properties: {
							newText: el.text
						}
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

	// Initialize ONLYOFFICE plugin hooks
	window.Asc.plugin.init = function() {
		log('Groq AI Copilot v3 PDK initialized.', 'success');
		loadSettings();
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

	// Bind chip-summarize click event
	chipSummarize.addEventListener('click', async () => {
		const apiKey = apiKeyInput.value.trim();
		if (!apiKey) {
			log('Error: Groq API Key is not configured. Add it in Settings.', 'error');
			tabSettings.click();
			return;
		}
		setLoading(true);
		log(`Summarizing document range [${scanRange === 'select' ? 'Selection Only' : 'Entire Document'}]...`, 'info');

		try {
			let docJSON = "";
			if (scanRange === "select") {
				docJSON = await serializeSelection();
			} else {
				docJSON = await serializeDocument();
			}
			
			const parsed = JSON.parse(docJSON);
			
			const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
				method: 'POST',
				headers: {
					'Authorization': `Bearer ${apiKey}`,
					'Content-Type': 'application/json'
				},
				body: JSON.stringify({
					model: modelSelect.value,
					messages: [
						{
							role: 'system',
							content: "You are an expert executive summary agent. Analyze the provided text and document structure and return an extremely high-quality summary in 3 to 5 concise bullet points. Format the output directly as clean plain text bullet points starting with standard dash '-' prefixes. Do not return any JSON or markdown blocks."
						},
						{
							role: 'user',
							content: `Document data: ${JSON.stringify(parsed)}`
						}
					],
					temperature: 0.2
				})
			});

			if (!response.ok) {
				throw new Error(`HTTP ${response.status}`);
			}

			const data = await response.json();
			activeSummaryContent = data.choices[0].message.content.trim();
			
			summaryText.innerText = activeSummaryContent;
			summaryCard.style.display = 'block';
			log("Executive summary compiled successfully by Groq AI!", "success");
		} catch (err) {
			log(`Summarization failed: ${err.message}`, 'error');
		} finally {
			setLoading(false);
		}
	});

	// Insert Summary button click event
	insertSummaryBtn.addEventListener('click', () => {
		if (!activeSummaryContent) return;
		log("Inserting summary directly at active cursor selection...", "info");

		window.Asc.scope.summaryText = "\n\n" + activeSummaryContent + "\n\n";
		window.Asc.plugin.callCommand(function() {
			var oDocument = Api.GetDocument();
			var oParagraph = Api.CreateParagraph();
			oParagraph.AddText(Asc.scope.summaryText);
			oDocument.InsertContent([oParagraph]);
			return "success";
		}, false, true, function(res) {
			log("Summary successfully inserted into document!", "success");
			summaryCard.style.display = 'none';
		});
	});

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
		log(`Scanning active range [${scanRange === 'select' ? 'Selection' : 'Entire Document'}] structure and elements...`, 'info');

		try {
			let docJSON = "";
			if (scanRange === "select") {
				docJSON = await serializeSelection();
			} else {
				docJSON = await serializeDocument();
			}
			
			cachedDocData = JSON.parse(docJSON);
			
			let totalElements = 0;
			if (cachedDocData.sections) {
				cachedDocData.sections.forEach(s => {
					totalElements += s.elements.length;
				});
			}

			if (totalElements === 0) {
				log('Error: Selection range is empty or invalid. Select text in the document first, or switch scan range to "Entire Document" in settings.', 'error');
				setLoading(false);
				return;
			}

			log(`Successfully scanned ${cachedDocData.sections.length} sections containing ${totalElements} elements.`, 'success');
			log(`Contacting Groq endpoint [api.groq.com/openai/v1] using model: ${modelSelect.value}...`, 'info');
			
			const aiResponse = await queryGroqAPI(apiKey, modelSelect.value, cachedDocData, prompt, scanRange === "select");
			
			log('Received secure API response from Groq.', 'success');
			
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

	// Dynamic selection text/range serializer with absolute document mapping
	function serializeSelection() {
		return new Promise((resolve, reject) => {
			const failTimeout = setTimeout(() => {
				reject(new Error("Selection scanning timed out. ONLYOFFICE sandbox did not respond."));
			}, 4000);

			window.Asc.plugin.callCommand(function() {
				var oDocument = Api.GetDocument();
				var oRange = null;
				try {
					oRange = oDocument.GetRangeBySelect();
				} catch(e) {}
				
				if (!oRange) return JSON.stringify({ sections: [] });
				
				var oText = oRange.GetText() || "";
				var selectedLines = oText.split(/[\r\n]+/);
				var paragraphs = [];
				
				var nCount = oDocument.GetElementsCount();
				for (var i = 0; i < nCount; i++) {
					try {
						var oElement = oDocument.GetElement(i);
						if (!oElement || oElement.GetClassType() !== "paragraph") continue;
						
						var pText = oElement.GetText() || "";
						var cleanPText = pText.trim();
						if (cleanPText === "") continue;
						
						// Check if this absolute paragraph text exists inside the selection lines list
						var isMatched = false;
						for (var j = 0; j < selectedLines.length; j++) {
							var cleanSel = selectedLines[j].trim();
							if (cleanSel.length > 0 && (cleanPText.indexOf(cleanSel) !== -1 || cleanSel.indexOf(cleanPText) !== -1)) {
								isMatched = true;
								break;
							}
						}
						
						if (isMatched) {
							// Extract formatting
							var oFontName = "Calibri";
							var oFontSize = 22;
							var oBold = false;
							var oItalic = false;
							var oColor = "#000000";
							
							try {
								var aRuns = oElement.GetElements();
								if (aRuns && aRuns.length > 0) {
									var oRun = aRuns[0];
									if (oRun) {
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
									}
								}
							} catch(errRun) {}
							
							var oAlign = "left";
							try { oAlign = oElement.GetJustification() || "left"; } catch(e) {}
							
							var oSpaceAfter = 0;
							try { oSpaceAfter = oElement.GetSpacingAfter() || 0; } catch(e) {}
							
							paragraphs.push({
								type: "paragraph",
								index: i, // Real Absolute Document Index!
								text: pText,
								style: {
									fontName: oFontName,
									fontSize: oFontSize / 2,
									bold: oBold,
									italic: oItalic,
									alignment: oAlign,
									color: oColor,
									spacingAfter: oSpaceAfter
								}
							});
						}
					} catch(elErr) {}
				}
				
				// Fallback: If no match found by text intersection, serialize selection range line-by-line relative
				if (paragraphs.length === 0) {
					for (var i = 0; i < Math.min(selectedLines.length, 30); i++) {
						var line = selectedLines[i].trim();
						if (!line) continue;
						paragraphs.push({
							type: "paragraph",
							index: i,
							text: selectedLines[i],
							style: {
								fontName: "Calibri",
								fontSize: 11,
								bold: false,
								italic: false,
								alignment: "left",
								color: "#000000",
								spacingAfter: 0
							}
						});
					}
				}

				return JSON.stringify({
					sectionsCount: 1,
					sections: [
						{
							title: "Active Selection Range",
							elements: paragraphs
						}
					]
				});
			}, false, true, function(result) {
				clearTimeout(failTimeout);
				if (result) {
					resolve(result);
				} else {
					reject(new Error("Unable to read selected text range."));
				}
			});
		});
	}

	// Document serialization - compiles sections, headings, paragraphs, and tables
	function serializeDocument() {
		return new Promise((resolve, reject) => {
			const failTimeout = setTimeout(() => {
				reject(new Error("Document scanning timed out. ONLYOFFICE sandbox did not respond."));
			}, 5000);

			window.Asc.plugin.callCommand(function() {
				var oDocument = Api.GetDocument();
				var nCount = oDocument.GetElementsCount();
				var sections = [];
				var currentSection = {
					title: "Root Section",
					elements: []
				};
				
				// Scan entire document (supporting up to 250 logical elements dynamically!)
				var limit = Math.min(nCount, 250);
				
				for (var i = 0; i < limit; i++) {
					try {
						var oElement = oDocument.GetElement(i);
						if (!oElement) continue;

						var type = oElement.GetClassType();
						
						if (type === "paragraph") {
							var oText = "";
							try { oText = oElement.GetText() || ""; } catch(e) {}

							// Fallback defaults
							var oFontName = "Calibri";
							var oFontSize = 22; // 11pt in half-points
							var oBold = false;
							var oItalic = false;
							var oColor = "#000000";

							// Extract styling from runs inside the paragraph elements list
							try {
								var aRuns = oElement.GetElements();
								if (aRuns && aRuns.length > 0) {
									for (var r = 0; r < aRuns.length; r++) {
										var oRun = aRuns[r];
										if (oRun) {
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
							try { oAlign = oElement.GetJustification() || "left"; } catch(e) {}

							var oSpaceAfter = 0;
							try { oSpaceAfter = oElement.GetSpacingAfter() || 0; } catch(e) {}

							// Robust dynamic heading heuristics
							var isHeading = false;
							var cleanText = oText.trim().replace(/[\r\n\t]+/g, '');
							
							// Rule 1: Font Sizing rules
							if ((oFontSize >= 28 || (oBold && oFontSize >= 24)) && cleanText.length > 0 && cleanText.length < 150) {
								isHeading = true;
							}
							// Rule 2: Upper Case Heading detection (e.g. "DECLARATION", "ABSTRACT")
							if (cleanText.length > 3 && cleanText.length < 80 && cleanText === cleanText.toUpperCase() && !/^\d+$/.test(cleanText)) {
								isHeading = true;
							}
							// Rule 3: Numbered heading prefix detection (e.g. "1.1 INTRODUCTION", "Chapter 1")
							if (/^(Chapter\s+\d+|\d+(\.\d+)*\s+[A-Za-z])/i.test(cleanText) && cleanText.length < 100) {
								isHeading = true;
							}

							var elementJSON = {
								type: "paragraph",
								index: i,
								text: oText,
								style: {
									fontName: oFontName,
									fontSize: oFontSize / 2, // Standardize to human points
									bold: oBold,
									italic: oItalic,
									alignment: oAlign,
									color: oColor,
									spacingAfter: oSpaceAfter
								}
							};

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
						} else if (type === "table") {
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
					} catch (pErr) {
						// Continue gracefully
					}
				}

				if (currentSection.elements.length > 0 || sections.length === 0) {
					sections.push(currentSection);
				}

				return JSON.stringify({
					sectionsCount: sections.length,
					sections: sections
				});
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

	// Query Groq API with robust schema and selection context mapping
	async function queryGroqAPI(apiKey, model, docData, prompt, isSelection = false) {
		const systemMessage = `You are a professional document typesetter and layout agent. Your task is to analyze the provided JSON representation of a ${isSelection ? 'selected range of a document' : 'document'} and generate the requested style or content changes as a valid JSON object.
		
Each paragraph and table has a unique, absolute "index" identifying its location in the document.

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

${isSelection ? 'IMPORTANT: You are targeting the ACTIVE SELECTION range. Apply modifications only targeting elements present inside the active selection.' : 'If the user wants a global change (e.g. "change the entire font color to yellow"), you MUST generate "modifyStyle" commands for EVERY single paragraph index in the document.'}
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
			const original = findElementByIndex(change.targetIndex);
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

			const originalText = original ? (original.text || `[Table Element at index #${change.targetIndex}]`) : '';

			item.innerHTML = `
				${actionBadge}
				<div style="font-weight: 600; margin-bottom: 2px;">Element #${change.targetIndex + 1}</div>
				${original ? `<div style="color: var(--text-secondary); margin-bottom: 4px; font-style: italic;">"${originalText.substring(0, 50)}${originalText.length > 50 ? '...' : ''}"</div>` : ''}
				${props.newText && original ? `
					<div class="diff-original">"${originalText}"</div>
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

	// Sequential, Animated, Interactive execution engine utilizing AddElement and RemoveElement
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
				log(`Executing Action: [Delete] Element #${change.targetIndex + 1}...`, 'warning');
			} else if (actionName === 'createParagraph') {
				log(`Executing Action: [Create] New Paragraph after #${change.targetIndex + 1}...`, 'success');
			} else {
				log(`Executing Action: [Formatting] Element #${change.targetIndex + 1}...`, 'info');
			}

			// Pass variable to sandboxed callCommand through ONLYOFFICE scope object
			window.Asc.scope.change = change;

			window.Asc.plugin.callCommand(function() {
				var change = Asc.scope.change;
				var oDocument = Api.GetDocument();
				var oParagraph = oDocument.GetElement(change.targetIndex);
				
				if (oParagraph) {
					try {
						// Focus/Scroll to active paragraph
						oParagraph.Select();
					} catch(e) {}
					
					var oProps = change.properties || {};
					
					if (change.action === 'deleteParagraph') {
						try { oDocument.RemoveElement(change.targetIndex); } catch(e) {}
						return "deleted";
					}
					
					if (change.action === 'createParagraph') {
						try {
							var oNewParagraph = Api.CreateParagraph();
							if (oProps.newText) {
								oNewParagraph.AddText(oProps.newText);
							}
							oDocument.AddElement(change.targetIndex + 1, oNewParagraph);
							oNewParagraph.Select();
						} catch(e) {}
						return "created";
					}

					// Direct run-level text and style updates to avoid selection dependencies
					try {
						var originalText = oParagraph.GetText() || "";
						var activeText = oProps.newText !== undefined ? oProps.newText : originalText;
						
						oParagraph.RemoveAllElements();
						var oRun = oParagraph.AddText(activeText);
						
						if (oRun) {
							if (oProps.fontName) oRun.SetFontName(oProps.fontName);
							// ONLYOFFICE FontSize is specified in half-points (e.g. 11pt = 22)
							if (oProps.fontSize) oRun.SetFontSize(oProps.fontSize);
							if (oProps.bold !== undefined) oRun.SetBold(oProps.bold);
							if (oProps.italic !== undefined) oRun.SetItalic(oProps.italic);
							
							if (oProps.color) {
								var hex = oProps.color.replace('#', '');
								if (hex.length === 6) {
									var r = parseInt(hex.substring(0, 2), 16);
									var g = parseInt(hex.substring(2, 4), 16);
									var b = parseInt(hex.substring(4, 6), 16);
									try {
										oRun.SetColor(Api.CreateColorFromRGB(r, g, b));
									} catch(eColor) {
										try {
											oRun.SetColor(r, g, b);
										} catch(errHex) {}
									}
								}
							}
						}
					} catch(e) {}

					// Apply paragraph-level styling
					try { if (oProps.alignment && oParagraph.SetJustification) oParagraph.SetJustification(oProps.alignment); } catch(e) {}
					try { if (oProps.spacingAfter !== undefined && oParagraph.SetSpacingAfter) oParagraph.SetSpacingAfter(oProps.spacingAfter); } catch(e) {}
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
