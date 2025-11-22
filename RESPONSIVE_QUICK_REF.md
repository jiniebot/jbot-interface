# Responsive Design Quick Reference

## Common Utility Classes

### Show/Hide Elements
```html
<div class="mobile-only">Mobile only</div>
<div class="tablet-only">Tablet only</div>
<div class="desktop-only">Desktop only</div>
```

### Flex Direction
```html
<div class="flex-row-desktop">Row on desktop, column on mobile</div>
<div class="flex-col-mobile">Column on mobile, row on desktop</div>
```

### Spacing
```html
<div class="responsive-padding">Auto-adjusting padding</div>
<div class="responsive-container">Max-width container with responsive padding</div>
```

### Touch Optimization
```html
<button class="touch-target">Minimum 44x44px button</button>
```

### Text Sizing
```html
<h1 class="responsive-text-xl">2.5rem → 1.75rem → 1.5rem</h1>
<h2 class="responsive-text-lg">1.5rem → 1.25rem → 1.125rem</h2>
<p class="responsive-text-md">1rem → 0.875rem → 0.8125rem</p>
```

### Grid Layout
```html
<div class="responsive-grid">
  <!-- Auto-responsive grid: 3 cols → 2 cols → 1 col -->
</div>
```

## Breakpoints

| Device | Width | CSS Variable |
|--------|-------|-------------|
| Mobile | 480px | `--breakpoint-mobile` |
| Tablet | 768px | `--breakpoint-tablet` |
| Desktop | 1024px | `--breakpoint-desktop` |
| Wide | 1440px | `--breakpoint-wide` |

## Writing Custom Media Queries

### Mobile First (Recommended)
```css
.element {
  /* Mobile styles (base) */
  padding: 1rem;
}

@media (min-width: 769px) {
  .element {
    /* Desktop enhancement */
    padding: 2rem;
  }
}
```

### Desktop First
```css
.element {
  /* Desktop styles (base) */
  padding: 2rem;
}

@media (max-width: 768px) {
  .element {
    /* Mobile override */
    padding: 1rem;
  }
}
```

### Specific Ranges
```css
/* Tablet only */
@media (min-width: 769px) and (max-width: 1024px) {
  .element { /* styles */ }
}

/* Mobile landscape */
@media (max-width: 768px) and (orientation: landscape) {
  .element { /* styles */ }
}
```

### Touch Devices
```css
/* Touch devices only */
@media (hover: none) and (pointer: coarse) {
  button:active { transform: scale(0.95); }
}

/* Desktop with mouse */
@media (hover: hover) and (pointer: fine) {
  button:hover { transform: scale(1.05); }
}
```

## Common Patterns

### Full-Screen Mobile Overlay
```css
@media (max-width: 768px) {
  .panel {
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    width: 100%;
    height: 100vh;
  }
}
```

### Bottom Sheet (Mobile)
```css
@media (max-width: 768px) {
  .sheet {
    position: fixed;
    bottom: 0;
    left: 0;
    right: 0;
    max-height: 70vh;
    border-radius: 20px 20px 0 0;
  }
}
```

### iOS Safe Areas
```css
.element {
  padding-bottom: 20px;
  padding-bottom: env(safe-area-inset-bottom);
}
```

### Hide Scrollbar on Mobile
```css
@media (max-width: 768px) {
  .element::-webkit-scrollbar {
    width: 4px;
  }
  
  .element::-webkit-scrollbar-thumb {
    background: rgba(255, 255, 255, 0.2);
  }
}
```

## Quick Checklist

### Mobile Optimization
- [ ] All buttons are at least 44x44px
- [ ] Font size in inputs is 16px+ (prevents zoom)
- [ ] Touch targets have adequate spacing
- [ ] No hover-only functionality
- [ ] Content fits without horizontal scroll
- [ ] Text is readable without zooming

### Performance
- [ ] Images are optimized
- [ ] Animations use `transform` and `opacity`
- [ ] Heavy content lazy loads
- [ ] CSS is minified in production

### Testing
- [ ] Tested on iPhone (portrait & landscape)
- [ ] Tested on Android device
- [ ] Tested on iPad/tablet
- [ ] Tested with slow network
- [ ] Tested with DevTools device emulation

## Variables You Can Customize

```css
:root {
  /* Breakpoints */
  --breakpoint-mobile: 480px;
  --breakpoint-tablet: 768px;
  --breakpoint-desktop: 1024px;
  --breakpoint-wide: 1440px;
  
  /* Touch sizing */
  --touch-target-min: 44px;
  --touch-spacing: 12px;
  
  /* Font scaling */
  --font-scale-mobile: 0.875;
  --font-scale-tablet: 0.9375;
  --font-scale-desktop: 1;
}
```

## Debugging Tips

### See Active Breakpoint
```javascript
// Add to console
window.getComputedStyle(document.body).width
```

### Check Touch Support
```javascript
// Add to console
'ontouchstart' in window
```

### Test Safe Areas
```javascript
// Add to console  
getComputedStyle(document.documentElement).getPropertyValue('--safe-area-inset-bottom')
```

## Resources

- 📖 Full guide: `RESPONSIVE_DESIGN_GUIDE.md`
- 🎨 Base utilities: `/css/responsive-base.css`
- 📱 Landing mobile: `/css/landing-mobile.css`
- 🗺️ Dashboard mobile: `/css/dashboard-mobile.css`
