# AIHub.jsx Bug Fixes Plan

## Task Analysis
Based on user feedback, need to fix 3 issues in AIHub.jsx:
1. Header glitch - sometimes hides/disappears incorrectly on scroll
2. API Key not fetching from saved DB - should load from user profile automatically  
3. Edit for generated images - need edit option for re-generating images

---

## Info Gathered
- **AIHub.jsx** - Main AI Hub component with header, model loading, key management
- **userService.js** - Already has `getProfile()` which includes all user fields including API keys
- **aiClient.js** - Has `setAiConfig()` and `syncAiKeys()` for key management

### Current Issues in Code:
1. **Header**: Uses `isHeaderHidden` state but scroll detection has race conditions - prevScrollYRef updates AFTER the check, causing glitches
2. **API Key**: No automatic fetch on mount - only loads from department or manual save
3. **Image Edit**: Only shows download button, no edit/regenerate option

---

## Plan

### Fix 1: Header Scroll Glitch
- **Problem**: `prevScrollYRef.current = scrollY` happens AFTER the shouldHide check, causing incorrect detection
- **Fix**: Update ref BEFORE the conditional check, add threshold check

### Fix 2: API Key Fetch from DB
- **Add**: UseEffect to fetch keys from user profile on mount using `getProfile()`
- **Keys to fetch**: geminiApiKey, openAiApiKey, claudeApiKey, stabilityApiKey, etc.
- **Behavior**: Auto-load if not in localStorage, allow user updates

### Fix 3: Edit Generated Image  
- **Add**: Edit button on generated image (next to download)
- **Action**: Opens image in edit mode with img2img (uses selectedMedia for reference)
- **Flow**: User edits prompt → regenerates with same/like image as base

---

## Implementation Steps

### Step 1: Fix Header Scroll (1 change)
In `handleChatScroll`:
```javascript
// Before the shouldHide check:
prevScrollYRef.current = scrollY; // Move BEFORE the check

// Then use prevScrollYRef in the check (not scrollY)
```

### Step 2: Add API Key Fetch on Mount (5 lines)
Add new useEffect:
```javascript
useEffect(() => {
  const fetchUserKeys = async () => {
    try {
      const profile = await getProfile();
      if (profile) {
        const dbKeys = {
          geminiKey: profile.geminiApiKey,
          openAiKey: profile.openAiApiKey,
          // ... etc
        };
        setAiConfig(provider, dbKeys);
      }
    } catch (err) { /* ignore */ }
  };
  if (user?._id) fetchUserKeys();
}, [user?._id]);
```

### Step 3: Add Image Edit Button (15 lines)
Add Edit button next to Download in generated image section:
- OnClick: setGenerationMode("image"), setInput(prompt from text), re-attach media

---

## Dependents
- client/src/services/userService.js (already imported)
- client/src/services/aiClient.js (already imported)

---

## Followup Steps
After fix, test:
1. Scroll up/down in chat - header should hide/show correctly
2. Refresh page - API keys should load from DB
3. Click edit on generated image - should allow re-generating

---
