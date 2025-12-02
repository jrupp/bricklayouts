/**
 * Tests for LayoutController rotation functionality
 * 
 * This test suite verifies that the rotation hotkey ('r') and the rotation button
 * both rotate components by the same amount (once, not twice).
 * 
 * Bug fix: Previously, pressing 'r' would call rotateSelectedComponent() twice
 * (once in the dragTarget/selectedComponent block and once in the selectedComponent block),
 * causing a 45-degree rotation instead of the expected 22.5-degree rotation.
 * 
 * This test uses static code analysis to verify the fix, checking that there's only
 * one 'r' key handler in the onKeyDown method.
 */

describe("LayoutController Rotation Bug Fix", () => {
    let sourceCode;

    // Fetch the source code once before running tests
    beforeAll(async () => {
        const response = await fetch('/src/controller/layoutController.js');
        sourceCode = await response.text();
    });

    /**
     * This test verifies the code structure of onKeyDown to ensure
     * the rotation handler is not duplicated.
     */
    describe("onKeyDown method structure", () => {
        it("should only have one 'r' key handler that calls rotateSelectedComponent", () => {
            // Extract the onKeyDown method with a flexible pattern
            const onKeyDownMatch = sourceCode.match(/onKeyDown\s*\(\s*event\s*\)\s*\{[\s\S]*?(?=\n\s{0,4}\w+\s*\()/);
            expect(onKeyDownMatch).not.toBeNull('onKeyDown method should exist in LayoutController');
            
            const onKeyDownCode = onKeyDownMatch[0];
            
            // Find all occurrences of the 'r' key check followed by rotateSelectedComponent
            // This pattern is flexible about whitespace and formatting
            const rotatePattern = /if\s*\(\s*event\s*\.\s*key\s*===\s*['"]r['"]\s*&&\s*!\s*event\s*\.\s*ctrlKey\s*\)\s*\{[\s\S]{0,50}?rotateSelectedComponent/g;
            const matches = onKeyDownCode.match(rotatePattern);
            
            // There should be exactly one occurrence
            expect(matches).not.toBeNull('At least one r key handler should exist');
            expect(matches.length).toBe(1, 
                `Expected exactly one 'r' key handler that calls rotateSelectedComponent in onKeyDown. ` +
                `Having multiple handlers causes double rotation. Found: ${matches.length}`);
        });

        it("should have the 'r' key handler in the dragTarget/selectedComponent block only", () => {
            // Extract the onKeyDown method with a flexible pattern
            const onKeyDownMatch = sourceCode.match(/onKeyDown\s*\(\s*event\s*\)\s*\{[\s\S]*?(?=\n\s{0,4}\w+\s*\()/);
            expect(onKeyDownMatch).not.toBeNull('onKeyDown method should exist');
            
            const onKeyDownCode = onKeyDownMatch[0];
            
            // Verify the 'r' key handler is in the first block (dragTarget || selectedComponent)
            // This pattern is flexible about whitespace
            const firstBlockPattern = /if\s*\(\s*LayoutController\s*\.\s*dragTarget\s*\|\|\s*LayoutController\s*\.\s*selectedComponent\s*\)\s*\{[\s\S]*?if\s*\(\s*event\s*\.\s*key\s*===\s*['"]r['"]/;
            expect(onKeyDownCode).toMatch(firstBlockPattern,
                "The 'r' key handler should be in the dragTarget/selectedComponent block");
            
            // Extract the selectedComponent-only block (the one checking for Delete)
            // This is a more robust way to find the block
            const selectedComponentBlockPattern = /if\s*\(\s*LayoutController\s*\.\s*selectedComponent\s*\)\s*\{[\s\S]*?if\s*\(\s*event\s*\.\s*key\s*===\s*['"]Delete['"]/;
            const selectedComponentBlockMatch = onKeyDownCode.match(selectedComponentBlockPattern);
            
            if (selectedComponentBlockMatch) {
                const selectedComponentBlock = selectedComponentBlockMatch[0];
                // The selectedComponent-only block should NOT contain a duplicate 'r' key handler
                const hasDuplicateRHandler = /if\s*\(\s*event\s*\.\s*key\s*===\s*['"]r['"]\s*&&\s*!\s*event\s*\.\s*ctrlKey\s*\)/.test(selectedComponentBlock);
                expect(hasDuplicateRHandler).toBe(false,
                    "The selectedComponent block should NOT have a duplicate 'r' key handler. " +
                    "This would cause double rotation.");
            }
        });
    });
});
