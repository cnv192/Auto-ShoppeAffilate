#!/bin/bash

# STEP 3 Verification Script
# Quick checks to verify STEP 3 is properly implemented

echo "🔍 STEP 3 VERIFICATION - Frontend Implementation"
echo "=================================================="
echo ""

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

passed=0
failed=0

# Function to check file exists and contains text
check_file_content() {
    local file=$1
    local text=$2
    local description=$3
    
    if [ -f "$file" ]; then
        if grep -q "$text" "$file"; then
            echo -e "${GREEN}✅${NC} $description"
            ((passed++))
        else
            echo -e "${RED}❌${NC} $description - text not found: $text"
            ((failed++))
        fi
    else
        echo -e "${YELLOW}⚠️${NC} $description - file not found: $file"
        ((failed++))
    fi
}

# Check public/index.html
echo -e "${BLUE}1. Checking public/index.html${NC}"
check_file_content "frontend/public/index.html" "__META_TITLE__" "Has __META_TITLE__ placeholder"
check_file_content "frontend/public/index.html" "__META_DESCRIPTION__" "Has __META_DESCRIPTION__ placeholder"
check_file_content "frontend/public/index.html" "__META_IMAGE__" "Has __META_IMAGE__ placeholder"
check_file_content "frontend/public/index.html" "__META_URL__" "Has __META_URL__ placeholder"
check_file_content "frontend/public/index.html" "og:title" "Has Open Graph meta tags"
echo ""

# Check build/index.html
echo -e "${BLUE}2. Checking frontend/build/index.html${NC}"
if [ -f "frontend/build/index.html" ]; then
    check_file_content "frontend/build/index.html" "__META_TITLE__" "Build has __META_TITLE__ placeholder"
    check_file_content "frontend/build/index.html" "__META_DESCRIPTION__" "Build has __META_DESCRIPTION__ placeholder"
else
    echo -e "${YELLOW}⚠️ Build directory not found - run 'npm run build' in frontend/${NC}"
fi
echo ""

# Check ArticleDetail.js
echo -e "${BLUE}3. Checking ArticleDetail.js${NC}"
check_file_content "frontend/src/components/ArticleDetail.js" "const StickyBanner" "Has StickyBanner component"
check_file_content "frontend/src/components/ArticleDetail.js" "injectCookieIframe" "Has cookie injection function"
check_file_content "frontend/src/components/ArticleDetail.js" "fetchArticle" "Has article fetching"
check_file_content "frontend/src/components/ArticleDetail.js" "fetchBanner" "Has banner fetching"
check_file_content "frontend/src/components/ArticleDetail.js" "handleBannerClick" "Has banner click handler"
check_file_content "frontend/src/components/ArticleDetail.js" "isMobile" "Has device detection"
check_file_content "frontend/src/components/ArticleDetail.js" "trackView" "Has view tracking"
echo ""

# Check renderController.js
echo -e "${BLUE}4. Checking renderController.js${NC}"
check_file_content "backend/src/controllers/renderController.js" "injectMetaTags" "Has meta injection function"
check_file_content "backend/src/controllers/renderController.js" "__META_TITLE__" "Meta injection replacements"
check_file_content "backend/src/controllers/renderController.js" "escapeHtml" "Has XSS prevention"
check_file_content "backend/src/controllers/renderController.js" "getReactTemplate" "Has template caching"
echo ""

# Check bannerController.js
echo -e "${BLUE}5. Checking bannerController.js${NC}"
check_file_content "backend/src/controllers/bannerController.js" "getRandom" "Has random banner function"
check_file_content "backend/src/controllers/bannerController.js" "recordClick" "Has click recording"
check_file_content "backend/src/controllers/bannerController.js" "recordImpression" "Has impression tracking"
echo ""

# Check routes are properly set up
echo -e "${BLUE}6. Checking API Routes${NC}"
check_file_content "backend/src/routes/bannerRoutes.js" "router.get" "Has banner routes"
check_file_content "backend/src/routes/redirectRoutes.js" "/:slug" "Has redirect routes"
check_file_content "backend/src/routes/linkRoutes.js" "/:slug" "Has link routes"
echo ""

# Check Bridge Server
echo -e "${BLUE}7. Checking Bridge Server${NC}"
check_file_content "bridge-server/index.js" "/go/:slug" "Has redirect endpoint"
check_file_content "bridge-server/index.js" "Link.findOne" "Has link lookup"
echo ""

# Print summary
echo -e "${BLUE}=================================================="
echo "VERIFICATION SUMMARY"
echo "==================================================${NC}"
echo -e "${GREEN}Passed:${NC} $passed"
echo -e "${RED}Failed:${NC} $failed"

total=$((passed + failed))
if [ $total -gt 0 ]; then
    percentage=$((passed * 100 / total))
    echo -e "Success Rate: ${percentage}%"
fi

echo ""

if [ $failed -eq 0 ]; then
    echo -e "${GREEN}✅ STEP 3 VERIFICATION PASSED!${NC}"
    echo "Frontend implementation is ready for deployment."
    exit 0
else
    echo -e "${RED}❌ STEP 3 VERIFICATION FAILED${NC}"
    echo "Please fix the issues above."
    exit 1
fi
