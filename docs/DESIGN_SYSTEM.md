# 🎨 **DESIGN_SYSTEM.md — Visual Design Specifications**

---

## **Overview**

This document defines the visual design system for Smart Translator. All UI components must follow these specifications for consistency.

---

# #️⃣ **1. Color Palette**

## **1.1 Primary Colors**

```css
:root {
  /* Primary Brand */
  --st-primary: #4A90E2;
  --st-primary-hover: #357ABD;
  --st-primary-active: #2868A8;
  
  /* Secondary */
  --st-secondary: #7B68EE;
  --st-secondary-hover: #6556D3;
  --st-secondary-active: #5144B8;
}
```

## **1.2 Neutral Colors**

```css
:root {
  /* Backgrounds */
  --st-bg-primary: #FFFFFF;
  --st-bg-secondary: #F7F9FC;
  --st-bg-tertiary: #EDF1F7;
  
  /* Surfaces */
  --st-surface: #FFFFFF;
  --st-surface-hover: #F7F9FC;
  
  /* Borders */
  --st-border-light: #E5E9F0;
  --st-border-medium: #D1D8E0;
  --st-border-dark: #B4BDC9;
}
```

## **1.3 Text Colors**

```css
:root {
  --st-text-primary: #1A2332;
  --st-text-secondary: #4F5B6C;
  --st-text-tertiary: #8896A8;
  --st-text-disabled: #C1C9D3;
  --st-text-inverse: #FFFFFF;
}
```

## **1.4 Semantic Colors**

```css
:root {
  /* Success */
  --st-success: #10B981;
  --st-success-bg: #D1FAE5;
  
  /* Warning */
  --st-warning: #F59E0B;
  --st-warning-bg: #FEF3C7;
  
  /* Error */
  --st-error: #EF4444;
  --st-error-bg: #FEE2E2;
  
  /* Info */
  --st-info: #3B82F6;
  --st-info-bg: #DBEAFE;
}
```

---

# #️⃣ **2. Typography**

## **2.1 Font Families**

```css
:root {
  --st-font-sans: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, 
                  "Helvetica Neue", Arial, sans-serif;
  --st-font-mono: "SF Mono", Monaco, "Cascadia Code", "Consolas", 
                  "Courier New", monospace;
}
```

## **2.2 Font Sizes**

```css
:root {
  --st-text-xs: 11px;
  --st-text-sm: 13px;
  --st-text-base: 14px;
  --st-text-lg: 16px;
  --st-text-xl: 18px;
  --st-text-2xl: 24px;
  --st-text-3xl: 30px;
}
```

## **2.3 Font Weights**

```css
:root {
  --st-font-normal: 400;
  --st-font-medium: 500;
  --st-font-semibold: 600;
  --st-font-bold: 700;
}
```

## **2.4 Line Heights**

```css
:root {
  --st-leading-tight: 1.25;
  --st-leading-normal: 1.5;
  --st-leading-relaxed: 1.75;
}
```

---

# #️⃣ **3. Spacing Scale**

```css
:root {
  --st-space-1: 4px;
  --st-space-2: 8px;
  --st-space-3: 12px;
  --st-space-4: 16px;
  --st-space-5: 20px;
  --st-space-6: 24px;
  --st-space-8: 32px;
  --st-space-10: 40px;
  --st-space-12: 48px;
  --st-space-16: 64px;
}
```

---

# #️⃣ **4. Border Radius**

```css
:root {
  --st-radius-sm: 4px;
  --st-radius-base: 8px;
  --st-radius-md: 12px;
  --st-radius-lg: 16px;
  --st-radius-xl: 24px;
  --st-radius-full: 9999px;
}
```

---

# #️⃣ **5. Shadows**

```css
:root {
  /* Elevation shadows */
  --st-shadow-sm: 0 1px 2px 0 rgba(0, 0, 0, 0.05);
  --st-shadow-base: 0 1px 3px 0 rgba(0, 0, 0, 0.1), 
                    0 1px 2px 0 rgba(0, 0, 0, 0.06);
  --st-shadow-md: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 
                  0 2px 4px -1px rgba(0, 0, 0, 0.06);
  --st-shadow-lg: 0 10px 15px -3px rgba(0, 0, 0, 0.1), 
                  0 4px 6px -2px rgba(0, 0, 0, 0.05);
  --st-shadow-xl: 0 20px 25px -5px rgba(0, 0, 0, 0.1), 
                  0 10px 10px -5px rgba(0, 0, 0, 0.04);
  
  /* Floating elements */
  --st-shadow-floating: 0 4px 20px rgba(0, 0, 0, 0.15);
}
```

---

# #️⃣ **6. Z-Index Layers**

```css
:root {
  --st-z-base: 1;
  --st-z-dropdown: 1000;
  --st-z-sticky: 1020;
  --st-z-fixed: 1030;
  --st-z-floating-icon: 999998;
  --st-z-modal: 999999;
  --st-z-tooltip: 1000000;
}
```

---

# #️⃣ **7. Animation & Transitions**

## **7.1 Duration**

```css
:root {
  --st-duration-fast: 150ms;
  --st-duration-base: 250ms;
  --st-duration-slow: 350ms;
  --st-duration-slower: 500ms;
}
```

## **7.2 Easing Functions**

```css
:root {
  --st-ease-in: cubic-bezier(0.4, 0, 1, 1);
  --st-ease-out: cubic-bezier(0, 0, 0.2, 1);
  --st-ease-in-out: cubic-bezier(0.4, 0, 0.2, 1);
  --st-ease-bounce: cubic-bezier(0.68, -0.55, 0.265, 1.55);
}
```

## **7.3 Common Animations**

```css
/* Fade In */
@keyframes st-fade-in {
  from {
    opacity: 0;
    transform: translateY(-5px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

/* Scale In */
@keyframes st-scale-in {
  from {
    opacity: 0;
    transform: scale(0.95);
  }
  to {
    opacity: 1;
    transform: scale(1);
  }
}

/* Slide Up */
@keyframes st-slide-up {
  from {
    opacity: 0;
    transform: translateY(10px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}
```

---

# #️⃣ **8. Component Specifications**

## **8.1 Floating Icon**

```css
.st-floating-icon {
  width: 32px;
  height: 32px;
  border-radius: var(--st-radius-full);
  background: var(--st-primary);
  box-shadow: var(--st-shadow-md);
  cursor: pointer;
  transition: transform var(--st-duration-fast) var(--st-ease-out);
  z-index: var(--st-z-floating-icon);
}

.st-floating-icon:hover {
  transform: scale(1.1);
  box-shadow: var(--st-shadow-lg);
}

.st-floating-icon:active {
  transform: scale(1.05);
}
```

## **8.2 Mini Popup**

```css
.st-mini-popup {
  background: var(--st-bg-primary);
  border-radius: var(--st-radius-md);
  box-shadow: var(--st-shadow-floating);
  padding: var(--st-space-4);
  min-width: 320px;
  max-width: 480px;
  font-family: var(--st-font-sans);
  animation: st-fade-in var(--st-duration-base) var(--st-ease-out);
  z-index: var(--st-z-modal);
}

.st-mini-popup__header {
  display: flex;
  align-items: center;
  gap: var(--st-space-2);
  margin-bottom: var(--st-space-3);
}

.st-mini-popup__arrow {
  color: var(--st-text-tertiary);
  font-size: var(--st-text-lg);
}

.st-mini-popup__original {
  padding: var(--st-space-3);
  background: var(--st-bg-secondary);
  border-radius: var(--st-radius-base);
  font-size: var(--st-text-sm);
  color: var(--st-text-secondary);
  margin-bottom: var(--st-space-3);
}

.st-mini-popup__translation {
  padding: var(--st-space-3);
  background: var(--st-bg-tertiary);
  border-radius: var(--st-radius-base);
  font-size: var(--st-text-base);
  color: var(--st-text-primary);
  margin-bottom: var(--st-space-4);
  min-height: 40px;
}

.st-mini-popup__translation.fade-in {
  animation: st-fade-in var(--st-duration-base) var(--st-ease-out);
}

.st-mini-popup__actions {
  display: flex;
  gap: var(--st-space-2);
  justify-content: flex-end;
}
```

## **8.3 Buttons**

```css
.st-btn {
  padding: var(--st-space-2) var(--st-space-4);
  border-radius: var(--st-radius-base);
  font-size: var(--st-text-sm);
  font-weight: var(--st-font-medium);
  border: none;
  cursor: pointer;
  transition: all var(--st-duration-fast) var(--st-ease-out);
  font-family: var(--st-font-sans);
}

/* Primary Button */
.st-btn--primary {
  background: var(--st-primary);
  color: var(--st-text-inverse);
}

.st-btn--primary:hover {
  background: var(--st-primary-hover);
}

.st-btn--primary:active {
  background: var(--st-primary-active);
}

/* Secondary Button */
.st-btn--secondary {
  background: var(--st-bg-secondary);
  color: var(--st-text-primary);
  border: 1px solid var(--st-border-medium);
}

.st-btn--secondary:hover {
  background: var(--st-surface-hover);
  border-color: var(--st-border-dark);
}

/* Ghost Button */
.st-btn--ghost {
  background: transparent;
  color: var(--st-text-secondary);
}

.st-btn--ghost:hover {
  background: var(--st-bg-secondary);
  color: var(--st-text-primary);
}
```

## **8.4 Select / Dropdown**

```css
.st-select {
  padding: var(--st-space-2) var(--st-space-3);
  border: 1px solid var(--st-border-medium);
  border-radius: var(--st-radius-base);
  font-size: var(--st-text-sm);
  font-family: var(--st-font-sans);
  background: var(--st-bg-primary);
  color: var(--st-text-primary);
  cursor: pointer;
  transition: border-color var(--st-duration-fast) var(--st-ease-out);
}

.st-select:hover {
  border-color: var(--st-border-dark);
}

.st-select:focus {
  outline: none;
  border-color: var(--st-primary);
  box-shadow: 0 0 0 3px rgba(74, 144, 226, 0.1);
}
```

## **8.5 Input / Textarea**

```css
.st-input {
  padding: var(--st-space-3);
  border: 1px solid var(--st-border-medium);
  border-radius: var(--st-radius-base);
  font-size: var(--st-text-base);
  font-family: var(--st-font-sans);
  background: var(--st-bg-primary);
  color: var(--st-text-primary);
  width: 100%;
  transition: border-color var(--st-duration-fast) var(--st-ease-out);
}

.st-input:hover {
  border-color: var(--st-border-dark);
}

.st-input:focus {
  outline: none;
  border-color: var(--st-primary);
  box-shadow: 0 0 0 3px rgba(74, 144, 226, 0.1);
}

.st-input::placeholder {
  color: var(--st-text-tertiary);
}
```

## **8.6 Card**

```css
.st-card {
  background: var(--st-surface);
  border: 1px solid var(--st-border-light);
  border-radius: var(--st-radius-md);
  padding: var(--st-space-6);
  box-shadow: var(--st-shadow-sm);
}

.st-card__header {
  font-size: var(--st-text-lg);
  font-weight: var(--st-font-semibold);
  color: var(--st-text-primary);
  margin-bottom: var(--st-space-4);
}

.st-card__body {
  color: var(--st-text-secondary);
  font-size: var(--st-text-base);
}
```

---

# #️⃣ **9. Layout Specifications**

## **9.1 Expand Mode Panel**

```css
.st-expand-panel {
  position: fixed;
  top: 0;
  right: 0;
  width: 50vw;
  height: 100vh;
  background: var(--st-bg-primary);
  box-shadow: var(--st-shadow-xl);
  z-index: var(--st-z-modal);
  animation: st-slide-in-right var(--st-duration-slow) var(--st-ease-out);
}

@keyframes st-slide-in-right {
  from {
    transform: translateX(100%);
  }
  to {
    transform: translateX(0);
  }
}

.st-expand-panel__header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: var(--st-space-4) var(--st-space-6);
  border-bottom: 1px solid var(--st-border-light);
}

.st-expand-panel__body {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: var(--st-space-4);
  padding: var(--st-space-6);
  height: calc(100% - 64px);
}
```

## **9.2 Options Page**

```css
.st-options {
  max-width: 800px;
  margin: 0 auto;
  padding: var(--st-space-8);
}

.st-options__header {
  font-size: var(--st-text-3xl);
  font-weight: var(--st-font-bold);
  color: var(--st-text-primary);
  margin-bottom: var(--st-space-8);
}

.st-options__section {
  margin-bottom: var(--st-space-8);
}

.st-options__section-title {
  font-size: var(--st-text-xl);
  font-weight: var(--st-font-semibold);
  color: var(--st-text-primary);
  margin-bottom: var(--st-space-4);
}
```

---

# #️⃣ **10. Responsive Breakpoints**

```css
:root {
  --st-breakpoint-sm: 640px;
  --st-breakpoint-md: 768px;
  --st-breakpoint-lg: 1024px;
  --st-breakpoint-xl: 1280px;
}

/* Example usage */
@media (max-width: 768px) {
  .st-expand-panel {
    width: 100vw;
  }
}
```

---

# #️⃣ **11. Icons**

## **11.1 Icon Sizes**

```css
:root {
  --st-icon-xs: 12px;
  --st-icon-sm: 16px;
  --st-icon-base: 20px;
  --st-icon-lg: 24px;
  --st-icon-xl: 32px;
}
```

## **11.2 Icon Library**

Use SVG icons from:
- **Heroicons** (recommended): https://heroicons.com/
- **Lucide**: https://lucide.dev/
- **Feather**: https://feathericons.com/

---

# #️⃣ **12. Accessibility**

## **12.1 Focus States**

```css
*:focus-visible {
  outline: 2px solid var(--st-primary);
  outline-offset: 2px;
}
```

## **12.2 Color Contrast**

All text must meet WCAG AA standards:
- Normal text: 4.5:1 contrast ratio
- Large text: 3:1 contrast ratio

## **12.3 Reduced Motion**

```css
@media (prefers-reduced-motion: reduce) {
  * {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
  }
}
```

---

# #️⃣ **13. Dark Mode (Future)**

```css
@media (prefers-color-scheme: dark) {
  :root {
    --st-bg-primary: #1A202C;
    --st-bg-secondary: #2D3748;
    --st-text-primary: #F7FAFC;
    --st-text-secondary: #E2E8F0;
    /* ... other dark mode colors */
  }
}
```

---

**Design system version: 1.0**  
**Last updated: November 2024**
