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
	const discardBtn = document.getElementById('discard-btn');

	// Undo / Redo selectors
	const toolbarUndo = document.getElementById('toolbar-undo');
	const toolbarRedo = document.getElementById('toolbar-redo');

	// Scan Range is determined dynamically

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

	// Scan range is now dynamic and automatic

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

	// Dynamic Document JSON Viewer compiler (debounced and fully dynamic)
	let isScanning = false;
	let isEditingAutonomously = false;
	async function refreshDocStructureView() {
		if (isScanning || isEditingAutonomously) return;
		isScanning = true;
		structureJson.value = "Scanning active document structure JSON...";
		try {
			const docJSON = await serializeActiveContent();
			const parsed = JSON.parse(docJSON);
			structureJson.value = JSON.stringify(parsed, null, 2);
			log(`Compiled structural JSON successfully [Mode: ${parsed.mode}].`, "success");
		} catch(err) {
			structureJson.value = "Error scanning document structure: " + err.message;
			log("Error loading structure: " + err.message, "error");
		} finally {
			isScanning = false;
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

	// Initialize ONLYOFFICE plugin hooks
	window.Asc.plugin.init = function() {
		log('Groq AI Copilot v3 PDK initialized.', 'success');
		loadSettings();
		
		// Attach to selection change event to dynamically update the JSON structure view instantly!
		try {
			this.attachEvent("onSelectionChanged", function() {
				debouncedRefresh();
			});
		} catch(e) {}

		try {
			this.attachEvent("onTargetPositionChanged", function() {
				debouncedRefresh();
			});
		} catch(e) {}
		
		// Initial scan
		refreshDocStructureView();
	};

	// Fallback direct event assignments on the plugin object
	window.Asc.plugin.event_onSelectionChanged = function() {
		debouncedRefresh();
	};
	window.Asc.plugin.event_onTargetPositionChanged = function() {
		debouncedRefresh();
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
		const apiKey = apiKeyInput.value.trim();
		if (!apiKey) {
			log('Error: Groq API Key is not configured. Add it in Settings.', 'error');
			tabSettings.click();
			return;
		}
		setLoading(true);

		try {
			const docJSON = await serializeActiveContent();
			const parsed = JSON.parse(docJSON);
			log(`Summarizing active range [${parsed.mode === 'selection' ? 'Selection Only' : 'Entire Document'}]...`, 'info');

			
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

		try {
			const docJSON = await serializeActiveContent();
			cachedDocData = JSON.parse(docJSON);
			
			let totalElements = 0;
			if (cachedDocData.sections) {
				cachedDocData.sections.forEach(s => {
					totalElements += s.elements.length;
				});
			}

			if (totalElements === 0) {
				log('Error: Selection range or document is empty.', 'error');
				setLoading(false);
				return;
			}

			log(`Successfully scanned ${cachedDocData.sections.length} sections containing ${totalElements} elements [Mode: ${cachedDocData.mode}].`, 'success');
			log(`Contacting Groq endpoint [api.groq.com/openai/v1] using model: ${modelSelect.value}...`, 'info');
			
			const aiResponse = await queryGroqAPI(apiKey, modelSelect.value, cachedDocData, prompt, cachedDocData.mode === "selection");
			
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
		
		confirmBtn.disabled = true;
		discardBtn.disabled = true;
		isEditingAutonomously = true;
		log('Starting animated autonomous editing workflow...', 'info');
		executeSequentialEdits(proposedChanges);
	});

	// Discard button click
	discardBtn.addEventListener('click', () => {
		log('Discarded proposed AI edits.', 'warning');
		proposedChanges = null;
		isEditingAutonomously = false;
		changesCard.style.display = 'none';
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

	// Dynamic selection text/range serializer with absolute document mapping
		// Consolidated dynamic selection or document serializer
	function serializeActiveContent() {
		return new Promise((resolve, reject) => {
			const failTimeout = setTimeout(() => {
				reject(new Error("Content scanning timed out. ONLYOFFICE sandbox did not respond."));
			}, 5000);

			window.Asc.plugin.callCommand(function() {
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
					if (!rColor) rColor = "#000000";

					return {
						fontName: rFontName,
						fontSize: rFontSize / 2,
						bold: !!rBold,
						italic: !!rItalic,
						underline: !!rUnderline,
						strikeout: !!rStrikeout,
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
						listType: listType
					};
				}

				// Define serializeRunsInside using rich style extraction
				function serializeRunsInside(oElement) {
					var runsData = [];
					try {
						var count = oElement.GetElementsCount();
						for (var r = 0; r < count; r++) {
							var oRun = oElement.GetElement(r);
							if (oRun && oRun.GetClassType() === "run") {
								var rText = oRun.GetText() || "";
								if (rText === "") continue;
								
								var runStyle = extractRunStyle(oRun, oElement);
								
								runsData.push({
									text: rText,
									style: runStyle
								});
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
				
				if (isSelection && selectedParagraphs.length > 0) {
					// --- SELECTION ONLY MODE (serialize only the highlighted range) ---
					var elements = [];
					
					for (var i = 0; i < selectedParagraphs.length; i++) {
						var selPara = selectedParagraphs[i];
						if (!selPara) continue;
						
						// Find the absolute document element index
						var absoluteIndex = -1;
						var elementsCount = oDocument.GetElementsCount();
						for (var j = 0; j < elementsCount; j++) {
							var docElem = oDocument.GetElement(j);
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
							for (var j = 0; j < elementsCount; j++) {
								var docElem = oDocument.GetElement(j);
								if (docElem && docElem.GetClassType() === "paragraph" && docElem.GetText() === selText) {
									absoluteIndex = j;
									break;
								}
							}
						}
						
						if (absoluteIndex === -1) {
							absoluteIndex = i;
						}
						
						var fullParaText = selPara.GetText() || "";
						var selectedText = selectedLines[i] || "";
						var startIndex = fullParaText.indexOf(selectedText);
						if (startIndex === -1) startIndex = 0;
						
						var runsData = [];
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
											runsData.push({
												text: slicedText,
												style: runStyle
											});
										}
									}
								}
							}
						} catch(errRuns) {}
						
						// If runs extraction intersects empty or misses, fall back to first run style or paragraph defaults
						if (runsData.length === 0 && selectedText.length > 0) {
							var pStyle = extractParagraphStyle(selPara);
							runsData.push({
								text: selectedText,
								style: {
									fontName: pStyle.fontName,
									fontSize: pStyle.fontSize,
									bold: pStyle.bold,
									italic: pStyle.italic,
									underline: pStyle.underline,
									strikeout: pStyle.strikeout,
									color: pStyle.color,
									highlight: null,
									shading: pStyle.shading
								}
							});
						}
						
						// Get paragraph style details
						var paraStyle = extractParagraphStyle(selPara);
						
						elements.push({
							type: "paragraph",
							index: absoluteIndex,
							text: selectedText,
							runs: runsData,
							style: paraStyle
						});
					}
					
					sections.push({
						title: "Active Selection Range",
						elements: elements
					});
					
				} else {
					// --- ENTIRE DOCUMENT MODE (Root Section fallback) ---
					var nCount = oDocument.GetElementsCount();
					var currentSection = {
						title: "Root Section",
						elements: []
					};
					
					var limit = Math.min(nCount, 250);
					for (var i = 0; i < limit; i++) {
						try {
							var oElement = oDocument.GetElement(i);
							if (!oElement) continue;
							
							var type = oElement.GetClassType();
							
							if (type === "paragraph") {
								var oText = oElement.GetText() || "";
								
								// Get paragraph style details
								var paraStyle = extractParagraphStyle(oElement);
								
								var cleanText = oText.trim().replace(/[\r\n\t]+/g, '');
								var isHeading = false;
								
								if ((paraStyle.fontSize * 2 >= 28 || (paraStyle.bold && paraStyle.fontSize * 2 >= 24)) && cleanText.length > 0 && cleanText.length < 150) {
									isHeading = true;
								}
								if (cleanText.length > 3 && cleanText.length < 80 && cleanText === cleanText.toUpperCase() && !/^\d+$/.test(cleanText)) {
									isHeading = true;
								}
								if (/^(Chapter\s+\d+|\d+(\.\d+)*\s+[A-Za-z])/i.test(cleanText) && cleanText.length < 100) {
									isHeading = true;
								}
								
								var elementJSON = {
									type: "paragraph",
									index: i,
									text: oText,
									runs: serializeRunsInside(oElement),
									style: paraStyle
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
						} catch(pErr) {}
					}
					
					if (currentSection.elements.length > 0 || sections.length === 0) {
						sections.push(currentSection);
					}
				}
				
				return JSON.stringify({
					mode: isSelection ? "selection" : "document",
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

	// Query Groq API with robust schema and selection context mapping
	async function queryGroqAPI(apiKey, model, docData, prompt, isSelection = false) {
		const systemMessage = `You are a professional document typesetter and layout agent. Your task is to analyze the provided JSON representation of a ${isSelection ? 'selected range of a document' : 'document'} and generate the requested style or content changes as a valid JSON object.
		
Each paragraph and table has a unique, absolute "index" identifying its location in the document.

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
- "modifyStyle": Set simple fonts, size, spacing, bold, alignment, color, or minor text updates on an existing paragraph index.
- "createParagraph": Create a new blank paragraph after the targetIndex.
- "deleteParagraph": Remove this paragraph from the document.

Formatting & units specifications for "modifyStyle":
- "fontName" (string, e.g. "Arial", "Georgia", "Inter", "Times New Roman", "Courier New")
- "fontSize" (integer): Must be in half-points (e.g., 22 for 11pt, 24 for 12pt, 28 for 14pt, 32 for 16pt, 48 for 24pt). The input document represents size in standard points, but you MUST write changes in half-points.
- "bold" (boolean)
- "italic" (boolean)
- "color" (string hex code like "#1d4ed8" or "#ffff00")
- "alignment" (string: "left", "right", "center", "justify")
- "spacingAfter" (integer, in dxa: 120 = 6pt, 240 = 12pt, 360 = 18pt)
- "newText" (string, optional - only provide for minor text edits or simple updates)

INLINE GRANULAR FORMATTING IN "newText" (Only when using "modifyStyle"):
If using "modifyStyle" and the user's prompt requests specific formatting of certain words, phrases, headings, or elements inside that paragraph, you can use standard inline HTML tags (<b>, <i>, <u>, <font color="#hex">, <mark>) inside "newText".
However, remember that "pasteHTML" is the absolute standard and is 100% preferred over "modifyStyle" for all long-form content generation and writing tasks!

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
		
		// Ensure control buttons are active and styled correctly when suggestions load
		confirmBtn.disabled = false;
		discardBtn.disabled = false;
		
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
			} else if (change.action === 'pasteHTML') {
				actionBadge = '<span class="badge-action action-generate" style="background: rgba(139, 92, 246, 0.15) !important; color: #a78bfa !important; border: 1px solid rgba(139, 92, 246, 0.3) !important;">Generate</span>';
			} else {
				actionBadge = '<span class="badge-action action-modify">Modify</span>';
			}

			let formatStr = '';
			const props = change.properties || {};
			if (props.fontName) formatStr += `Font: <b>${props.fontName}</b>; `;
			if (props.fontSize) formatStr += `Size: <b>${props.fontSize/2}pt</b>; `;
			if (props.bold !== undefined) formatStr += props.bold ? '<b>Bold</b>; ' : 'Regular; ';
			if (props.italic !== undefined) formatStr += props.italic ? '<i>Italic</i>; ' : 'No Italic; ';
			if (props.underline !== undefined) formatStr += props.underline ? '<u>Underline</u>; ' : 'No Underline; ';
			if (props.strikeout !== undefined) formatStr += props.strikeout ? '<strike>Strike</strike>; ' : 'No Strike; ';
			if (props.alignment) formatStr += `Align: <b>${props.alignment}</b>; `;
			if (props.color) formatStr += `Color: <span style="color: ${props.color}; font-weight: bold;">${props.color}</span>; `;
			if (props.highlight) formatStr += `Highlight: <span style="background-color: ${props.highlight}; color: #000; font-weight: bold; padding: 1px 4px; border-radius: 3px;">${props.highlight}</span>; `;

			const originalText = original ? (original.text || `[Table Element at index #${change.targetIndex}]`) : '';

			let diffHTML = '';
			if (change.action === 'deleteParagraph') {
				diffHTML = `
					<div class="diff-original" style="background: rgba(239, 68, 68, 0.08); border-left: 3px solid var(--error); padding: 8px; border-radius: 4px; font-family: monospace; font-size: 11px;">- "${originalText}"</div>
				`;
			} else if (change.action === 'createParagraph') {
				diffHTML = `
					<div class="diff-new" style="background: rgba(16, 185, 129, 0.08); border-left: 3px solid var(--success); padding: 8px; border-radius: 4px; font-family: monospace; font-size: 11px;">+ "${props.newText || ''}"</div>
				`;
			} else if (change.action === 'pasteHTML') {
				const tempDiv = document.createElement('div');
				tempDiv.innerHTML = props.html || '';
				const textOnly = tempDiv.textContent || tempDiv.innerText || '';
				const cleanSnippet = textOnly.length > 150 ? textOnly.substring(0, 150) + '...' : textOnly;
				diffHTML = `
					<div class="diff-new" style="background: rgba(139, 92, 246, 0.08); border-left: 3px solid #8b5cf6; padding: 8px; border-radius: 4px; font-family: monospace; font-size: 11px;">✨ <b>Rich Content Generated:</b> "${cleanSnippet}"</div>
				`;
			} else {
				// modify
				if (props.newText !== undefined && props.newText !== originalText) {
					diffHTML = `
						<div class="diff-original" style="background: rgba(239, 68, 68, 0.05); border-left: 3px solid var(--error); padding: 8px; border-radius: 4px 4px 0 0; font-family: monospace; font-size: 11px; margin-bottom: 2px;">- "${originalText}"</div>
						<div class="diff-new" style="background: rgba(16, 185, 129, 0.05); border-left: 3px solid var(--success); padding: 8px; border-radius: 0 0 4px 4px; font-family: monospace; font-size: 11px;">+ "${props.newText}"</div>
					`;
				} else if (originalText) {
					diffHTML = `
						<div style="background: rgba(255, 255, 255, 0.02); border-left: 3px solid var(--text-secondary); padding: 8px; border-radius: 4px; font-style: italic; color: var(--text-secondary); font-size: 11.5px;">"${originalText.substring(0, 100)}${originalText.length > 100 ? '...' : ''}"</div>
					`;
				}
			}

			item.innerHTML = `
				<div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px;">
					<span style="font-weight: 700; color: var(--text-primary); font-size: 11.5px;">Element #${change.targetIndex + 1}</span>
					${actionBadge}
				</div>
				<div style="display: flex; flex-direction: column; gap: 4px; margin-bottom: 6px;">
					${diffHTML}
				</div>
				${formatStr ? `
					<div style="font-size: 11px; color: var(--primary); background: rgba(245, 158, 11, 0.05); border: 1px dashed rgba(245, 158, 11, 0.25); padding: 6px; border-radius: 4px; margin-top: 4px; line-height: 1.4;">
						✨ <b>Style Changes:</b> ${formatStr}
					</div>
				` : ''}
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
				// Re-enable confirm and discard buttons
				confirmBtn.disabled = false;
				discardBtn.disabled = false;
				isEditingAutonomously = false;
				changesCard.style.display = 'none';
				
				// Perform single clean refresh of structure view once editor modifications finish
				setTimeout(() => {
					refreshDocStructureView();
				}, 200);
				return;
			}

			const change = changes[i];
			const actionName = change.action || 'modifyStyle';
			
			if (actionName === 'deleteParagraph') {
				log(`Executing Action: [Delete] Element #${change.targetIndex + 1}...`, 'warning');
			} else if (actionName === 'createParagraph') {
				log(`Executing Action: [Create] New Paragraph after #${change.targetIndex + 1}...`, 'success');
			} else if (actionName === 'pasteHTML') {
				log(`Executing Action: [Generative Typesetting] Elements starting at #${change.targetIndex + 1}...`, 'success');
				// Pass variable through scope
				window.Asc.scope.change = change;
				window.Asc.plugin.callCommand(function() {
					var change = Asc.scope.change;
					var oDocument = Api.GetDocument();
					var oParagraph = oDocument.GetElement(change.targetIndex);
					if (oParagraph) {
						oParagraph.Select();
					}
					return "selected";
				}, false, true, function() {
					// Call PasteHtml natively on the parent plugin object
					window.Asc.plugin.executeMethod("PasteHtml", [change.properties.html || ''], function() {
						i++;
						setTimeout(applyNext, 300);
					});
				});
				return;
			} else {
				log(`Executing Action: [Formatting] Element #${change.targetIndex + 1}...`, 'info');
			}

			// Pass variables through scope
			window.Asc.scope.change = change;

			window.Asc.plugin.callCommand(function() {
				// Helper to parse HTML tags and build individual runs dynamically in the paragraph
				function parseAndApplyTextWithTags(oPar, htmlStr, defFont, defSize, defBold, defItalic, defUnderline, defStrikeout, defColorHex, pProps) {
					try { oPar.RemoveAllElements(); } catch(e) {}
					var regex = /(<[^>]+>)/g;
					var parts = htmlStr.split(regex);
					var formatState = {
						fontName: pProps.fontName || defFont || "Calibri",
						fontSize: pProps.fontSize || defSize || 22,
						bold: pProps.bold !== undefined ? pProps.bold : (defBold !== undefined ? defBold : false),
						italic: pProps.italic !== undefined ? pProps.italic : (defItalic !== undefined ? defItalic : false),
						underline: pProps.underline !== undefined ? pProps.underline : (defUnderline !== undefined ? defUnderline : false),
						strikeout: pProps.strikeout !== undefined ? pProps.strikeout : (defStrikeout !== undefined ? defStrikeout : false),
						color: pProps.color || defColorHex || "#000000",
						highlight: pProps.highlight || "none"
					};
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
								} else if (tagLower.indexOf("<font") === 0) {
									var match = part.match(/color=["']([^"']+)["']/i);
									if (match && match[1]) newState.color = match[1];
								} else if (tagLower.indexOf("<mark") === 0) {
									var match = part.match(/color=["']([^"']+)["']/i);
									if (match && match[1]) {
										newState.highlight = match[1];
									} else {
										newState.highlight = "yellow";
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
									try { oRun.SetFontName(formatState.fontName); } catch(e) {}
								}
								if (formatState.fontSize) {
									try { oRun.SetFontSize(formatState.fontSize); } catch(e) {}
								}
								try { oRun.SetBold(!!formatState.bold); } catch(e) {}
								try { oRun.SetItalic(!!formatState.italic); } catch(e) {}
								try { oRun.SetUnderline(!!formatState.underline); } catch(e) {}
								try { oRun.SetStrikeout(!!formatState.strikeout); } catch(e) {}
								
								if (formatState.highlight) {
									try {
										var hl = formatState.highlight.toLowerCase();
										if (hl === "none" || hl === "null" || hl === "default") oRun.SetHighlight("none");
										else if (hl.indexOf("yellow") !== -1 || hl === "#ffff00") oRun.SetHighlight("yellow");
										else if (hl.indexOf("green") !== -1 || hl === "#00ff00") oRun.SetHighlight("green");
										else if (hl.indexOf("blue") !== -1 || hl === "#0000ff" || hl === "#00ffff") oRun.SetHighlight("cyan");
										else if (hl.indexOf("red") !== -1 || hl === "#ff0000") oRun.SetHighlight("red");
										else oRun.SetHighlight(hl);
									} catch(eHighlight) {}
								}
								
								if (formatState.color) {
									try {
										var hex = String(formatState.color).replace('#', '');
										if (hex.length === 6) {
											var r = parseInt(hex.substring(0, 2), 16);
											var g = parseInt(hex.substring(2, 4), 16);
											var b = parseInt(hex.substring(4, 6), 16);
											try { oRun.SetColor(Api.CreateColorFromRGB(r, g, b)); } catch(eColor) {
												try { oRun.SetColor(r, g, b); } catch(errHex) {}
											}
										}
									} catch(eColorOuter) {}
								}
							}
						}
					}
				}

				var change = Asc.scope.change;
				var oDocument = Api.GetDocument();
				var oParagraph = oDocument.GetElement(change.targetIndex);
				
				// Extract original styles safely first so all actions can access them
				var origFont = "Calibri";
				var origSize = 22;
				var origBold = false;
				var origItalic = false;
				var origUnderline = false;
				var origStrikeout = false;
				var origColorHex = "#000000";
				
				if (oParagraph) {
					try {
						var runCount = oParagraph.GetElementsCount();
						if (runCount > 0) {
							var firstRun = oParagraph.GetElement(0);
							if (firstRun) {
								var textPr = null;
								try {
									if (typeof firstRun.GetTextPr === "function") textPr = firstRun.GetTextPr();
								} catch(eTextPr) {}
								
								if (textPr) {
									try {
										if (typeof textPr.GetFontFamily === "function") origFont = textPr.GetFontFamily() || origFont;
										else if (typeof textPr.GetFontNames === "function") {
											var names = textPr.GetFontNames();
											if (names && names.length > 0) origFont = names[0] || origFont;
										}
									} catch(eFont) {}
									
									try {
										if (typeof textPr.GetFontSize === "function") origSize = textPr.GetFontSize() || origSize;
									} catch(eSize) {}
									
									try {
										if (typeof textPr.GetBold === "function") origBold = textPr.GetBold() || origBold;
									} catch(eBold) {}
									
									try {
										if (typeof textPr.GetItalic === "function") origItalic = textPr.GetItalic() || origItalic;
									} catch(eItalic) {}
									
									try {
										if (typeof textPr.GetUnderline === "function") origUnderline = !!textPr.GetUnderline();
									} catch(eUnderline) {}
									
									try {
										if (typeof textPr.GetStrikeout === "function") origStrikeout = !!textPr.GetStrikeout();
									} catch(eStrikeout) {}
									
									try {
										if (typeof textPr.GetColor === "function") {
											var c = textPr.GetColor();
											if (c && typeof c.GetHex === "function") origColorHex = c.GetHex() || origColorHex;
										}
									} catch(eColor) {}
								} else {
									try { if (typeof firstRun.GetFontName === "function") origFont = firstRun.GetFontName() || origFont; } catch(e) {}
									try { if (typeof firstRun.GetFontSize === "function") origSize = firstRun.GetFontSize() || origSize; } catch(e) {}
									try { if (typeof firstRun.GetBold === "function") origBold = firstRun.GetBold() || origBold; } catch(e) {}
									try { if (typeof firstRun.GetItalic === "function") origItalic = firstRun.GetItalic() || origItalic; } catch(e) {}
									try { if (typeof firstRun.GetUnderline === "function") origUnderline = !!firstRun.GetUnderline(); } catch(e) {}
									try { if (typeof firstRun.GetStrikeout === "function") origStrikeout = !!firstRun.GetStrikeout(); } catch(e) {}
									try {
										if (typeof firstRun.GetColor === "function") {
											var c = firstRun.GetColor();
											if (c && typeof c.GetHex === "function") origColorHex = c.GetHex() || origColorHex;
										}
									} catch(e) {}
								}
							}
						}
					} catch(eOuter) {}
				}

				if (change.action === 'deleteParagraph') {
					try { oDocument.RemoveElement(change.targetIndex); } catch(e) {}
					return "deleted";
				}
				
				if (change.action === 'createParagraph') {
					try {
						var oNewParagraph = Api.CreateParagraph();
						var oProps = change.properties || {};
						oDocument.AddElement(change.targetIndex + 1, oNewParagraph);
						oNewParagraph.Select();
						
						if (oProps.newText) {
							parseAndApplyTextWithTags(oNewParagraph, oProps.newText, origFont, origSize, origBold, origItalic, origUnderline, origStrikeout, origColorHex, oProps);
						}
					} catch(e) {}
					return "created";
				}

				if (oParagraph) {
					try {
						// Focus/Scroll to active paragraph
						oParagraph.Select();
					} catch(e) {}
					
					var oProps = change.properties || {};
					
					// Direct run-level text and style updates to avoid selection dependencies
					try {
						if (oProps.newText !== undefined) {
							parseAndApplyTextWithTags(oParagraph, oProps.newText, origFont, origSize, origBold, origItalic, origUnderline, origStrikeout, origColorHex, oProps);
						} else {
							// Reconstruct run with existing text to guarantee robust styling application
							var currentText = oParagraph.GetText() || "";
							currentText = currentText.replace(/[\r\n]+$/, "");
							parseAndApplyTextWithTags(oParagraph, currentText, origFont, origSize, origBold, origItalic, origUnderline, origStrikeout, origColorHex, oProps);
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
					try { if (oProps.spacingAfter !== undefined && oParagraph.SetSpacingAfter) oParagraph.SetSpacingAfter(oProps.spacingAfter); } catch(e) {}
					try { if (oProps.spacingBefore !== undefined && oParagraph.SetSpacingBefore) oParagraph.SetSpacingBefore(oProps.spacingBefore); } catch(e) {}
					try {
						if (oProps.lineSpacing !== undefined && oParagraph.SetSpacingLine) {
							var rule = oProps.lineSpacingRule || "auto";
							var val = oProps.lineSpacingTwips || Math.round(oProps.lineSpacing * 240);
							oParagraph.SetSpacingLine(val, rule);
						}
					} catch(e) {}
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
