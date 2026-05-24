// Automated integration test for super-docx selection serializers
// This mocks the ONLYOFFICE DOM document and elements structure to verify stop-word filtering & run parsing logic.

const assert = require('assert');

// Mock Run class
class MockRun {
    constructor(text, fontName, fontSize, bold, italic, hexColor) {
        this.text = text;
        this.fontName = fontName;
        this.fontSize = fontSize;
        this.bold = bold;
        this.italic = italic;
        this.hexColor = hexColor;
    }
    GetClassType() { return "run"; }
    GetText() { return this.text; }
    GetFontName() { return this.fontName; }
    GetFontSize() { return this.fontSize; }
    GetBold() { return this.bold; }
    GetItalic() { return this.italic; }
    GetColor() {
        return { GetHex: () => this.hexColor };
    }
}

// Mock Paragraph class
class MockParagraph {
    constructor(text, runs = [], justification = "left", spacingAfter = 0) {
        this.text = text;
        this.runs = runs;
        this.justification = justification;
        this.spacingAfter = spacingAfter;
    }
    GetClassType() { return "paragraph"; }
    GetText() { return this.text; }
    GetElements() { return this.runs; }
    GetJustification() { return this.justification; }
    GetSpacingAfter() { return this.spacingAfter; }
}

// Mock serializeRuns function (mirrors plugin.js exactly)
function mockSerializeRuns(oElement) {
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

// Mock selection matcher logic (mirrors plugin.js exactly)
function testSelectionMatching(selectedText, documentElements) {
    const selectedLines = selectedText.split(/[\r\n]+/);
    const matchedParagraphs = [];

    for (let i = 0; i < documentElements.length; i++) {
        const oElement = documentElements[i];
        if (oElement.GetClassType() !== "paragraph") continue;

        const pText = oElement.GetText() || "";
        const cleanPText = pText.trim();
        if (cleanPText === "") continue;

        let isMatched = false;
        for (let j = 0; j < selectedLines.length; j++) {
            const cleanSel = selectedLines[j].trim();
            if (cleanSel.length > 0) {
                if (cleanPText === cleanSel || cleanPText.indexOf(cleanSel) !== -1 || cleanSel.indexOf(cleanPText) !== -1) {
                    // Enforce exact match check on short text selections to avoid stop words matching
                    if (cleanSel.length < 5 && cleanPText !== cleanSel) {
                        continue;
                    }
                    isMatched = true;
                    break;
                }
            }
        }

        if (isMatched) {
            matchedParagraphs.push({
                index: i,
                text: pText,
                runs: mockSerializeRuns(oElement)
            });
        }
    }
    return matchedParagraphs;
}

// ---- TEST RUNNER ----

// Mock Document Elements
const mockDoc = [
    // 0: Paragraph that just contains stop word "of"
    new MockParagraph("of\n", [new MockRun("of\n", "Calibri", 22, false, false, "#000000")]),
    // 1: Normal sentence containing word "of"
    new MockParagraph("We affirm that the Project report is original.\n", [
        new MockRun("We affirm that the Project report is original.\n", "Calibri", 22, false, false, "#000000")
    ]),
    // 2: Target paragraph with nested bold runs
    new MockParagraph("FarmSentinel - Wildlife Threat Detection and Drone Guidance System for Crop Protection\n", [
        new MockRun("FarmSentinel - ", "Calibri", 22, true, false, "#000000"), // nested bold phrase!
        new MockRun("Wildlife Threat Detection and Drone Guidance System for Crop Protection\n", "Calibri", 22, false, false, "#000000")
    ]),
    // 3: Unrelated paragraph containing "of"
    new MockParagraph("This is unrelated, but contains word of wisdom.\n", [
        new MockRun("This is unrelated, but contains word of wisdom.\n", "Calibri", 22, false, false, "#000000")
    ])
];

console.log("🧪 Running Stop-Word and Nesting Serialization Tests...");

// Test Case 1: Matching a short stop-word exactly
console.log("\n1. Testing short exact-match selector on 'of'...");
const matchExactOf = testSelectionMatching("of", mockDoc);
assert.strictEqual(matchExactOf.length, 1);
assert.strictEqual(matchExactOf[0].index, 0); // Only matches paragraph 0 (exact match), not 1 or 3!
console.log("✅ Passed: Exact stop-word match isolated successfully!");

// Test Case 2: Matching long title and extracting nested bold runs
console.log("\n2. Testing nested bold parsing in 'FarmSentinel'...");
const matchTitle = testSelectionMatching("FarmSentinel - Wildlife Threat Detection and Drone Guidance System for Crop Protection", mockDoc);
assert.strictEqual(matchTitle.length, 1);
assert.strictEqual(matchTitle[0].index, 2);
assert.strictEqual(matchTitle[0].runs.length, 2);
assert.strictEqual(matchTitle[0].runs[0].style.bold, true); // Verified bold is correctly recognized!
assert.strictEqual(matchTitle[0].runs[1].style.bold, false);
console.log("✅ Passed: Nested bold run detected and serialized correctly!");

console.log("\n🎉 All mock integration tests completed successfully!");
