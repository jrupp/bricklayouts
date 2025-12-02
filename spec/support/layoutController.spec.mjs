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
    /**
     * This test verifies the code structure of onKeyDown to ensure
     * the rotation handler is not duplicated.
     */
    describe("onKeyDown method structure", () => {
        it("should only have one 'r' key handler that calls rotateSelectedComponent", async () => {
            // Import the LayoutController source code as text
            const response = await fetch('/src/controller/layoutController.js');
            const sourceCode = await response.text();
            
            // Extract the onKeyDown method
            const onKeyDownMatch = sourceCode.match(/onKeyDown\s*\(event\)\s*{\s*[\s\S]*?(?=\n  \w+\s*\(|$)/);
            expect(onKeyDownMatch).not.toBeNull('onKeyDown method should exist in LayoutController');
            
            const onKeyDownCode = onKeyDownMatch[0];
            
            // Find all occurrences of the 'r' key check followed by rotateSelectedComponent
            const rotatePattern = /if\s*\(\s*event\.key\s*===\s*['"]r['"]\s*&&\s*!event\.ctrlKey\s*\)\s*{[\s\S]*?rotateSelectedComponent/g;
            const matches = onKeyDownCode.match(rotatePattern);
            
            // There should be exactly one occurrence
            expect(matches).not.toBeNull('At least one r key handler should exist');
            expect(matches.length).toBe(1, 
                "Expected exactly one 'r' key handler that calls rotateSelectedComponent in onKeyDown. " +
                "Having multiple handlers causes double rotation. Found: " + matches.length);
        });

        it("should have the 'r' key handler in the dragTarget/selectedComponent block only", async () => {
            // Import the LayoutController source code as text
            const response = await fetch('/src/controller/layoutController.js');
            const sourceCode = await response.text();
            
            // Extract the onKeyDown method
            const onKeyDownMatch = sourceCode.match(/onKeyDown\s*\(event\)\s*{\s*[\s\S]*?(?=\n  \w+\s*\(|$)/);
            expect(onKeyDownMatch).not.toBeNull('onKeyDown method should exist');
            
            const onKeyDownCode = onKeyDownMatch[0];
            
            // Verify the 'r' key handler is in the first block (dragTarget || selectedComponent)
            const firstBlockPattern = /if\s*\(\s*LayoutController\.dragTarget\s*\|\|\s*LayoutController\.selectedComponent\s*\)\s*{[\s\S]*?if\s*\(\s*event\.key\s*===\s*['"]r['"]/;
            expect(onKeyDownCode).toMatch(firstBlockPattern,
                "The 'r' key handler should be in the dragTarget/selectedComponent block");
            
            // Extract the selectedComponent-only block (the one checking for Delete)
            const selectedComponentBlockPattern = /if\s*\(\s*LayoutController\.selectedComponent\s*\)\s*{[\s\S]*?if\s*\(\s*event\.key\s*===\s*['"]Delete['"]/;
            const selectedComponentBlockMatch = onKeyDownCode.match(selectedComponentBlockPattern);
            
            if (selectedComponentBlockMatch) {
                const selectedComponentBlock = selectedComponentBlockMatch[0];
                // The selectedComponent-only block should NOT contain a duplicate 'r' key handler
                const hasDuplicateRHandler = /if\s*\(\s*event\.key\s*===\s*['"]r['"]\s*&&\s*!event\.ctrlKey\s*\)/.test(selectedComponentBlock);
                expect(hasDuplicateRHandler).toBe(false,
                    "The selectedComponent block should NOT have a duplicate 'r' key handler. " +
                    "This would cause double rotation.");
            }
        });
    });
});
