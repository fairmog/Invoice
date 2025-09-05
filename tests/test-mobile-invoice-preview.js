/**
 * Test Mobile Invoice Preview Zoom & Pan Functionality
 * This test validates the mobile-specific enhancements work correctly
 */

import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const projectRoot = join(__dirname, '..');

async function testMobileInvoicePreview() {
    console.log('📱 Testing Mobile Invoice Preview Enhancements...\n');
    
    let testsPassed = 0;
    let testsTotal = 0;

    try {
        // Read the HTML file
        const htmlPath = join(projectRoot, 'src', 'web-interface-indonesian.html');
        const htmlContent = readFileSync(htmlPath, 'utf8');

        // Test 1: Check viewport meta tag allows zoom
        console.log('🔍 Test 1: Viewport allows zoom and pan...');
        testsTotal++;
        
        const viewportMatch = htmlContent.match(/<meta name="viewport" content="([^"]*)">/);
        const viewportContent = viewportMatch ? viewportMatch[1] : '';
        
        if (viewportContent.includes('user-scalable=yes') && 
            viewportContent.includes('maximum-scale=3.0') && 
            viewportContent.includes('minimum-scale=0.5')) {
            console.log('✅ Test 1 PASSED: Viewport allows zoom and pan');
            testsPassed++;
        } else {
            console.log('❌ Test 1 FAILED: Viewport settings incorrect');
            console.log('Found:', viewportContent);
        }

        // Test 2: Mobile zoom controls HTML structure
        console.log('\n📱 Test 2: Mobile zoom controls HTML exists...');
        testsTotal++;
        
        const hasMobileControls = htmlContent.includes('id="mobile-zoom-controls"');
        const hasZoomInBtn = htmlContent.includes('id="zoom-in-btn"');
        const hasZoomOutBtn = htmlContent.includes('id="zoom-out-btn"');
        const hasFitScreenBtn = htmlContent.includes('id="fit-screen-btn"');
        
        if (hasMobileControls && hasZoomInBtn && hasZoomOutBtn && hasFitScreenBtn) {
            console.log('✅ Test 2 PASSED: All mobile zoom controls exist');
            testsPassed++;
        } else {
            console.log('❌ Test 2 FAILED: Missing mobile zoom controls');
            console.log('Controls found:', {
                mobileControls: hasMobileControls,
                zoomIn: hasZoomInBtn,
                zoomOut: hasZoomOutBtn,
                fitScreen: hasFitScreenBtn
            });
        }

        // Test 3: PDF preview container structure
        console.log('\n📄 Test 3: PDF preview container structure...');
        testsTotal++;
        
        const hasPreviewContainer = htmlContent.includes('id="pdf-preview-container"');
        const hasPreviewWrapper = htmlContent.includes('id="pdf-preview-wrapper"');
        const hasPdfPreview = htmlContent.includes('id="pdf-preview"');
        
        if (hasPreviewContainer && hasPreviewWrapper && hasPdfPreview) {
            console.log('✅ Test 3 PASSED: PDF preview structure correct');
            testsPassed++;
        } else {
            console.log('❌ Test 3 FAILED: PDF preview structure incomplete');
            console.log('Elements found:', {
                container: hasPreviewContainer,
                wrapper: hasPreviewWrapper,
                preview: hasPdfPreview
            });
        }

        // Test 4: Mobile CSS classes exist
        console.log('\n🎨 Test 4: Mobile-specific CSS classes...');
        testsTotal++;
        
        const cssContent = htmlContent;
        const hasMobileZoomControls = cssContent.includes('.mobile-zoom-controls');
        const hasMobileScaling = cssContent.includes('--mobile-scale-factor');
        const hasZoomBtn = cssContent.includes('.zoom-btn');
        const hasPanSupport = cssContent.includes('.pan-indicator');
        
        if (hasMobileZoomControls && hasMobileScaling && hasZoomBtn && hasPanSupport) {
            console.log('✅ Test 4 PASSED: All mobile CSS classes present');
            testsPassed++;
        } else {
            console.log('❌ Test 4 FAILED: Missing mobile CSS classes');
            console.log('CSS classes found:', {
                mobileControls: hasMobileZoomControls,
                scaleFactor: hasMobileScaling,
                zoomBtn: hasZoomBtn,
                panSupport: hasPanSupport
            });
        }

        // Test 5: JavaScript functions exist
        console.log('\n⚙️ Test 5: Mobile zoom JavaScript functions...');
        testsTotal++;
        
        const hasInitializeFunction = cssContent.includes('function initializeMobileZoom()');
        const hasAdjustZoomFunction = cssContent.includes('function adjustZoom(');
        const hasTouchGesturesFunction = cssContent.includes('function addTouchGestureSupport()');
        const hasPanSupportFunction = cssContent.includes('function addPanSupport()');
        const hasFitToScreenFunction = cssContent.includes('function fitToScreen()');
        
        if (hasInitializeFunction && hasAdjustZoomFunction && hasTouchGesturesFunction && 
            hasPanSupportFunction && hasFitToScreenFunction) {
            console.log('✅ Test 5 PASSED: All JavaScript functions present');
            testsPassed++;
        } else {
            console.log('❌ Test 5 FAILED: Missing JavaScript functions');
            console.log('Functions found:', {
                initialize: hasInitializeFunction,
                adjustZoom: hasAdjustZoomFunction,
                touchGestures: hasTouchGesturesFunction,
                panSupport: hasPanSupportFunction,
                fitToScreen: hasFitToScreenFunction
            });
        }

        // Test 6: Touch gesture support
        console.log('\n👆 Test 6: Touch gesture implementation...');
        testsTotal++;
        
        const hasPinchZoom = cssContent.includes('Math.hypot(');
        const hasDoubleTap = cssContent.includes('tapGap < 300');
        const hasTouchEvents = cssContent.includes('touchstart') && 
                              cssContent.includes('touchmove') && 
                              cssContent.includes('touchend');
        
        if (hasPinchZoom && hasDoubleTap && hasTouchEvents) {
            console.log('✅ Test 6 PASSED: Touch gesture support implemented');
            testsPassed++;
        } else {
            console.log('❌ Test 6 FAILED: Incomplete touch gesture support');
            console.log('Touch features found:', {
                pinchZoom: hasPinchZoom,
                doubleTap: hasDoubleTap,
                touchEvents: hasTouchEvents
            });
        }

        // Test 7: A4 format preservation
        console.log('\n📐 Test 7: A4 format preservation...');
        testsTotal++;
        
        const hasA4Dimensions = cssContent.includes('width: 210mm') && 
                               cssContent.includes('min-height: 297mm');
        const hasA4PixelCalc = cssContent.includes('794'); // 210mm in pixels
        const hasAspectRatio = cssContent.includes('A4 aspect ratio');
        
        if (hasA4Dimensions && hasA4PixelCalc && hasAspectRatio) {
            console.log('✅ Test 7 PASSED: A4 format preserved');
            testsPassed++;
        } else {
            console.log('❌ Test 7 FAILED: A4 format not properly preserved');
            console.log('A4 features found:', {
                dimensions: hasA4Dimensions,
                pixelCalc: hasA4PixelCalc,
                aspectRatio: hasAspectRatio
            });
        }

        // Test 8: Responsive behavior
        console.log('\n📱 Test 8: Responsive behavior implementation...');
        testsTotal++;
        
        const hasMediaQuery = cssContent.includes('@media (max-width: 767px)');
        const hasResizeListener = cssContent.includes("addEventListener('resize'");
        const hasMobileDetection = cssContent.includes('window.innerWidth <= 767');
        
        if (hasMediaQuery && hasResizeListener && hasMobileDetection) {
            console.log('✅ Test 8 PASSED: Responsive behavior implemented');
            testsPassed++;
        } else {
            console.log('❌ Test 8 FAILED: Incomplete responsive behavior');
            console.log('Responsive features found:', {
                mediaQuery: hasMediaQuery,
                resizeListener: hasResizeListener,
                mobileDetection: hasMobileDetection
            });
        }

        // Final Results
        console.log('\n🎯 TEST RESULTS:');
        console.log('================');
        console.log(`✅ Tests Passed: ${testsPassed}/${testsTotal}`);
        console.log(`❌ Tests Failed: ${testsTotal - testsPassed}/${testsTotal}`);
        
        if (testsPassed === testsTotal) {
            console.log('\n🎉 ALL TESTS PASSED!');
            console.log('📱 Mobile invoice preview enhancements are correctly implemented');
            console.log('\n🚀 Features Available:');
            console.log('  • Pinch-to-zoom support');
            console.log('  • Double-tap zoom toggle'); 
            console.log('  • Floating zoom controls (+, -, fit-to-screen)');
            console.log('  • Pan/drag when zoomed in');
            console.log('  • A4 format preservation with smart scaling');
            console.log('  • Touch-friendly interface');
            console.log('  • Responsive design');
        } else {
            console.log('\n⚠️  Some tests failed. Review the implementation.');
        }

        // Test Instructions
        console.log('\n📖 TESTING ON MOBILE DEVICE:');
        console.log('==========================');
        console.log('1. Open the invoice generator on a mobile device');
        console.log('2. Create a new invoice preview');
        console.log('3. Look for floating zoom controls on the right side');
        console.log('4. Test pinch-to-zoom gestures');
        console.log('5. Try double-tapping to zoom');
        console.log('6. Use + and - buttons to adjust zoom');
        console.log('7. Use ⌂ button to fit invoice to screen');
        console.log('8. When zoomed in, drag to pan around');
        console.log('9. Watch for zoom percentage indicator');
        console.log('10. Verify full invoice content is visible and readable');

    } catch (error) {
        console.error('💥 Test suite failed:', error.message);
    }
}

if (import.meta.url === `file://${process.argv[1]}`) {
    testMobileInvoicePreview();
}

export default testMobileInvoicePreview;