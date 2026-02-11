# Cursor Playground Design System

A bold, playful design system inspired by Matisse-style compositions and brutalist web aesthetics. Built for creative tools that need personality without sacrificing usability.

---

## The Vibe

**This is the desk of someone who makes things.**

Imagine a designer's workspace—not the sterile minimalist kind, but a *living* one. Colorful paper cutouts. Sticky notes with scribbled ideas. Plants spilling over the edges. A ceramic mug that doesn't match anything. It's organized enough to work, chaotic enough to inspire.

That's the feeling we're after: **creative confidence**.

### Mood Words

- Playful, not childish
- Bold, not aggressive  
- Warm, not saccharine
- Crafted, not polished
- Energetic, not overwhelming
- Confident, not arrogant

### What We Feel Like

- A sunny studio with big windows
- Colorful magnets on a vintage fridge
- An art supply store in a college town
- Memphis design meets Swiss functionality
- The satisfying *click* of a physical button
- Paper cutouts and construction paper
- A Polaroid pinned to a cork board

### What We Don't Feel Like

- Corporate software
- Sterile SaaS dashboards
- Dark mode everything
- Glassy, blurred, translucent UI
- Gradient soup
- "Premium" minimalism
- AI-generated genericness

---

## Design Principles

### 1. Confidence Over Perfection

Don't hedge. Make bold choices—thick borders, saturated colors, impactful type. A slightly off-kilter layout with personality beats a perfectly centered bore. If something feels "almost too much," it's probably right.

### 2. Physicality

Everything should feel like it has weight and texture. Buttons look like they can be pressed. Cards feel like paper. Shadows are hard-edged because objects in real life cast real shadows. No ethereal floating—things sit *on* surfaces.

### 3. Joy as a Feature

Delight isn't decoration—it's functionality. A playful hover state makes the interface more learnable. A hand-drawn annotation makes instructions more approachable. Small moments of joy reduce cognitive load and build trust.

### 4. Clarity Through Contrast

Bold aesthetics require clear hierarchy. When everything is loud, nothing is. Use color and scale to create unmistakable focal points. The user should never wonder "what do I do next?"

### 5. Restraint Within Expression

Freedom requires limits. We have a specific palette, specific type, specific shadows. Within those constraints, go wild. Consistency in the system creates coherence; creativity within it creates character.

### 6. Made by Humans, for Humans

This should feel *crafted*—like someone chose each color, placed each element, considered each interaction. Fight the algorithmic aesthetic. Embrace the handmade quality that makes digital feel human.

---

## Philosophy (Technical)

**Bold but approachable.** We use thick borders, strong colors, and unapologetic typography—but always in service of clarity. Every visual choice should feel intentional and joyful.

**Structured chaos.** Our layouts embrace asymmetry and unexpected compositions while maintaining a clear visual hierarchy. Think organized creativity, not random noise.

**Tactile and responsive.** Interactions should feel physical—like pressing buttons, sliding panels, and stacking cards. Hover states and animations reinforce this tangible quality.

---

## Color Palette

### Core Colors

| Token | Hex | Role |
|-------|-----|------|
| `--cream-white` | `#F5F2ED` | **Primary Background** — Main canvas, body background, large open areas |
| `--bg-periwinkle` | `#B8C8DC` | **Surface/Card** — Cards, panels, elevated surfaces, input backgrounds |
| `--ink` | `#1a1a1a` | **Text & Borders** — Primary text, borders, icons, strong UI elements |

### Accent Colors

| Token | Hex | Role |
|-------|-----|------|
| `--cobalt-blue` | `#2B4FD6` | **Primary Action** — CTAs, primary buttons, links, focus states |
| `--forest-green` | `#1B6B4D` | **Success/Growth** — Success states, positive actions, nature metaphors |
| `--coral-red` | `#E94E3D` | **Energy/Warning** — Destructive actions, alerts, high-energy accents |
| `--sunny-yellow` | `#F7C948` | **Highlight/Attention** — Badges, highlights, callouts, new features |
| `--deep-purple` | `#5B4BB5` | **Premium/Creative** — Pro features, creative tools, secondary actions |
| `--blush-pink` | `#F5C4C0` | **Soft Accent** — Gentle highlights, onboarding, friendly moments |

### Color Usage Principles

1. **60-30-10 Rule**: 60% neutrals (`cream-white`, `periwinkle`), 30% supporting (`ink`, one accent), 10% highlight (accent pop)

2. **Accent Restraint**: Use no more than 2-3 accent colors per view. Each screen should have one dominant accent.

3. **Semantic Consistency**: Once you assign meaning to a color, maintain it:
   - Blue = primary action, navigation, interactive
   - Green = success, confirmation, growth
   - Red = danger, delete, urgent attention
   - Yellow = warning, highlight, "new"
   - Purple = premium, creative, special

4. **High Contrast**: Text must always meet WCAG AA standards. Use `--ink` on light backgrounds. Use `--cream-white` on dark/saturated backgrounds.

---

## Typography

### Font Stack

```css
--font-display: 'Anton', 'Impact', sans-serif;
--font-mono: 'Space Mono', 'Courier New', monospace;
--font-script: 'Caveat', cursive;
```

### Usage

| Font | Use Case |
|------|----------|
| **Anton** | Headlines, hero text, section titles, buttons, navigation. Always uppercase. |
| **Space Mono** | Body text, labels, captions, data, code, UI chrome. Conveys precision. |
| **Caveat** | Annotations, handwritten notes, playful callouts, personality moments. Use sparingly. |

### Scale

```
Display:  clamp(4rem, 12vw, 11rem)   — Hero headlines
H1:       clamp(3rem, 8vw, 6rem)     — Section titles  
H2:       clamp(2rem, 5vw, 3rem)     — Subsection headers
H3:       clamp(1.5rem, 3vw, 2rem)   — Card titles
Body:     1rem - 1.1rem              — Paragraphs, descriptions
Small:    0.85rem - 0.9rem           — Captions, labels, metadata
```

### Typography Rules

1. **Anton is always uppercase** — It's designed for impact. Lowercase looks wrong.

2. **Space Mono is always bold for UI** — At small sizes, use `font-weight: 700` for legibility.

3. **Caveat is a spice** — Use it for 1-3 words max. Perfect for annotations like "New!", "Try this", "Magic!".

4. **Line height**: Display text = 0.85-0.95. Body text = 1.5-1.6.

5. **Letter spacing**: Anton can go tight (-0.02em). Space Mono stays default or slightly positive.

---

## Borders & Shadows

### Border System

```css
--border-width: 2.5px;
```

**Standard border**: `2.5px solid var(--ink)`

Borders are a defining characteristic of this system. They should feel intentional and bold—never hairline or tentative.

### Shadow System

We use **offset shadows** instead of blur shadows. This creates the brutalist, sticker-like aesthetic.

```css
/* Hover state */
transform: translate(-4px, -4px);
box-shadow: 4px 4px 0 var(--ink);

/* Active/pressed */
transform: translate(0, 0);
box-shadow: none;
```

Shadow colors can vary for emphasis:
- `var(--ink)` — Default, strong
- `var(--cobalt-blue)` — Interactive elements
- `var(--sunny-yellow)` — Highlighted elements
- `var(--coral-red)` — Destructive actions

---

## Spacing

### Base Unit

```css
--spacing-unit: 1rem; /* 16px */
```

### Scale

```
4px   (0.25rem)  — Tight gaps, icon padding
8px   (0.5rem)   — Small gaps, inline spacing
16px  (1rem)     — Standard gap, card padding
24px  (1.5rem)   — Section gaps, comfortable padding
32px  (2rem)     — Large gaps, section separators
48px  (3rem)     — Major section breaks
64px+ (4rem+)    — Hero spacing, dramatic pauses
```

### Principles

1. **Generous whitespace** — Don't crowd. Let elements breathe.
2. **Consistent rhythm** — Stick to the scale. Avoid arbitrary values.
3. **Responsive compression** — Spacing can reduce on mobile, but maintain ratios.

---

## Components

### Buttons

**Primary Button**
```css
background: var(--cobalt-blue);
color: var(--cream-white);
border: var(--border-width) solid var(--ink);
font-family: var(--font-display);
text-transform: uppercase;
padding: 1rem 2.2rem;

&:hover {
  transform: translate(-4px, -4px);
  box-shadow: 4px 4px 0 var(--sunny-yellow);
}
```

**Secondary Button**
```css
background: var(--cream-white);
color: var(--ink);
border: var(--border-width) solid var(--ink);

&:hover {
  background: var(--blush-pink);
  box-shadow: 4px 4px 0 var(--cobalt-blue);
}
```

**Destructive Button**
```css
background: var(--coral-red);
color: var(--cream-white);

&:hover {
  box-shadow: 4px 4px 0 var(--ink);
}
```

### Cards

```css
background: var(--bg-periwinkle);
border: var(--border-width) solid var(--ink);
padding: 1.5rem;

&:hover {
  transform: translate(-4px, -4px);
  box-shadow: 4px 4px 0 var(--ink);
}
```

### Badges / Tags

**Standard Badge**
```css
border: var(--border-width) solid var(--ink);
padding: 0.4rem 1rem;
font-family: var(--font-mono);
font-weight: 700;
text-transform: uppercase;
font-size: 0.9rem;
```

**Highlight Badge**
```css
background: var(--sunny-yellow);
/* Same border and text styles */
```

**Oval/Pill Badge**
```css
border-radius: 50%;
padding: 0.8rem 2rem;
font-family: var(--font-display);
transform: rotate(-5deg); /* Optional playfulness */
```

### Inputs

```css
background: var(--bg-periwinkle);
border: var(--border-width) solid var(--ink);
padding: 0.75rem 1rem;
font-family: var(--font-mono);

&:focus {
  outline: none;
  box-shadow: 4px 4px 0 var(--cobalt-blue);
  transform: translate(-2px, -2px);
}
```

---

## Decorative Elements

### Sparkles / Stars

Four-pointed stars used for visual interest and "magic" moments.

```svg
<path d="M50 0 C50 0 60 40 100 50 C60 60 50 100 50 100 C50 100 40 60 0 50 C40 40 50 0 50 0Z"/>
```

- Animate with `rotation` and subtle `scale`
- Use accent colors: yellow, coral, purple, green
- Add `stroke: var(--ink)` for definition

### Blobs

Morphing organic shapes for background atmosphere.

- Use `mix-blend-mode: multiply` for color interaction
- Animate `border-radius` for organic movement
- Keep opacity at 0.5-0.7 to not overwhelm content

### Connection Lines

SVG paths for visual flow and relationships.

```css
stroke: var(--ink);
stroke-width: 1.5px;
stroke-dasharray: 5,5; /* Optional dashed style */
```

### Floating Labels

Small contextual text scattered in hero areas.

```css
font-family: var(--font-mono);
font-size: 0.85rem;
text-transform: uppercase;
font-weight: 700;
opacity: 0.7;
```

---

## Motion

### Principles

1. **Quick and snappy** — Most transitions: 150-200ms
2. **Physical metaphors** — Elements should feel like they have weight
3. **Purposeful** — Animation communicates state change, not decoration

### Timing Functions

```css
/* Standard easing */
transition: all 0.2s ease;

/* Bouncy/playful */
transition: transform 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275);
```

### Standard Animations

**Hover lift**
```css
transform: translate(-4px, -4px);
box-shadow: 4px 4px 0 var(--ink);
```

**Press/Active**
```css
transform: translate(0, 0) scale(0.98);
```

**Float (decorative)**
```css
@keyframes float {
  0%, 100% { transform: translateY(0); }
  50% { transform: translateY(-8px); }
}
animation: float 4s ease-in-out infinite;
```

**Spin (sparkles)**
```css
@keyframes spin {
  0% { transform: rotate(0deg) scale(1); }
  50% { transform: rotate(180deg) scale(1.2); }
  100% { transform: rotate(360deg) scale(1); }
}
animation: spin 6s linear infinite;
```

---

## Responsive Behavior

### Breakpoints

```css
/* Tablet */
@media (max-width: 1024px) { }

/* Mobile */
@media (max-width: 768px) { }

/* Small mobile */
@media (max-width: 480px) { }
```

### Adaptation Rules

1. **Typography scales down** — Use `clamp()` for fluid sizing
2. **Decorations simplify** — Hide or reduce floating elements, sparkles
3. **Borders stay thick** — Never reduce border-width
4. **Shadows can reduce** — 4px → 3px offset on mobile
5. **Spacing compresses** — But maintain visual rhythm

---

## Accessibility

### Requirements

- **Color contrast**: All text meets WCAG AA (4.5:1 for body, 3:1 for large text)
- **Focus states**: Visible, high-contrast focus indicators on all interactive elements
- **Motion**: Respect `prefers-reduced-motion` — disable animations for users who request it

```css
@media (prefers-reduced-motion: reduce) {
  * {
    animation-duration: 0.01ms !important;
    transition-duration: 0.01ms !important;
  }
}
```

### Color Combinations (Tested)

✅ **Safe pairings:**
- `--ink` on `--cream-white` 
- `--ink` on `--bg-periwinkle`
- `--ink` on `--sunny-yellow`
- `--ink` on `--blush-pink`
- `--cream-white` on `--cobalt-blue`
- `--cream-white` on `--forest-green`
- `--cream-white` on `--coral-red`
- `--cream-white` on `--deep-purple`
- `--cream-white` on `--ink`

⚠️ **Avoid:**
- Light text on `--sunny-yellow` (use `--ink` instead)
- `--blush-pink` text on any background (too low contrast)

---

## Voice & Tone

The visual language has a voice. When writing copy for this system:

### We Sound Like

- A smart friend who's excited to help
- A teacher who uses their hands when they talk
- Someone explaining something at a whiteboard
- Enthusiastic but not manic
- Clear but not clinical

### We Say

- "Let's try this" not "Execute action"
- "Oops! Something went wrong" not "Error 500"
- "Nice work!" not "Operation successful"
- "What do you want to make?" not "Select project type"

### Writing Principles

1. **Active voice** — "You created a new project" not "A new project was created"
2. **Short sentences** — Get to the point. Then elaborate if needed.
3. **Contractions are cool** — "You'll love this" feels warmer than "You will love this"
4. **Questions invite action** — "Ready to publish?" beats "Publish now"
5. **Celebrate small wins** — Every completed action deserves acknowledgment

---

## Do's and Don'ts

### Do ✓

**Visual**
- Use thick, confident borders—they're our signature
- Let one accent color dominate per section
- Embrace asymmetry; off-center can feel more alive
- Use generous whitespace—let things breathe
- Add slight rotations to badges and cards for energy
- Use hard-edged offset shadows, never blur

**Interaction**
- Make hover states feel like physical responses
- Give every clickable element a satisfying state change
- Use the lift-and-shadow pattern consistently
- Add micro-moments of delight where unexpected

**Typography**
- Keep Anton UPPERCASE, always
- Use Caveat for short, playful annotations
- Make headlines BIG—bigger than you think
- Trust Space Mono for everything else

**Personality**
- Add sparkles and decorations where it feels earned
- Let the interface have opinions
- Use color boldly—this isn't a time to be subtle

### Don't ✗

**Visual**
- Use thin/hairline borders—they break the whole vibe
- Use blur shadows—we're brutalist, not glassmorphic  
- Go grayscale—our palette exists for a reason
- Make everything perfectly aligned—too sterile
- Use gradients—flat color has more character here

**Interaction**  
- Forget focus states—accessibility isn't optional
- Make users guess what's clickable
- Use animations without purpose
- Let decorations block content

**Typography**
- Use Anton in lowercase—it looks broken
- Make Caveat annotations longer than 3-4 words
- Mix too many font weights—keep it simple
- Use generic system fonts

**Personality**
- Be ironic or sarcastic in copy
- Add whimsy that slows users down
- Let "playful" become "annoying"
- Copy other design systems—this has its own identity

---

## Inspiration & References

### Art & Design Movements

- **Henri Matisse's cutouts** — Bold shapes, limited palette, joyful composition
- **Memphis Design (1980s)** — Playful geometry, unexpected color, anti-minimalist
- **Bauhaus** — Form follows function, but form can be fun
- **Polish Poster Art** — Bold typography, symbolic imagery, confident composition
- **Brutalist Web Design** — Raw, honest, thick borders, no pretense

### Contemporary References

- Figma's brand personality (not their UI)
- Notion's playful illustrations
- Linear's confident typography
- Poolside FM's retro-digital warmth
- The cheerful chaos of a well-loved Miro board

### Physical Touchstones

- Construction paper and scissors
- Refrigerator magnet poetry
- Museum gift shop postcards
- Japanese stationery
- Vintage Fischer-Price toys
- LEGO instruction manuals

### What to Study

When designing new patterns, ask:
- "Would this feel at home on a designer's messy desk?"
- "Does this have the confidence of a screen-printed poster?"
- "Could a child understand this hierarchy?"
- "Is there one thing that makes this *ours*?"

---

## Extending the System

When adding new components or patterns, follow these principles:

### Before You Build

1. **Check the kitchen first** — Does something similar exist? Can you adapt it?
2. **Name the purpose** — What job does this component do? Write it in one sentence.
3. **Find a family** — What existing components should this feel related to?

### While You Build

1. **Start with tokens** — Use existing colors, fonts, spacing. Don't invent.
2. **Border first** — Add the 2.5px border. Does it still look right? Good.
3. **Test the hover** — Apply the translate + shadow pattern. Does it feel physical?
4. **Check the states** — Default, hover, active, focus, disabled. All need love.
5. **Mobile gut-check** — Does this work at 375px wide? Adjust if needed.

### After You Build

1. **Screenshot it** — Put it next to existing components. Does it belong?
2. **Get a second opinion** — Fresh eyes catch drift faster
3. **Document it** — Add to this file with the same level of detail

### When to Break the Rules

Rules exist to create coherence. Break them only when:

- The use case genuinely can't be served by existing patterns
- You've tried three ways to make it work within the system
- The exception makes the product better, not just different
- You document *why* it's an exception

---

## Quick Reference

```css
/* Import fonts */
@import url('https://fonts.googleapis.com/css2?family=Anton&family=Space+Mono:ital,wght@0,400;0,700;1,400&family=Caveat:wght@600&display=swap');

/* Core variables */
:root {
  /* Backgrounds */
  --cream-white: #F5F2ED;
  --bg-periwinkle: #B8C8DC;
  --ink: #1a1a1a;
  
  /* Accents */
  --cobalt-blue: #2B4FD6;
  --forest-green: #1B6B4D;
  --coral-red: #E94E3D;
  --sunny-yellow: #F7C948;
  --deep-purple: #5B4BB5;
  --blush-pink: #F5C4C0;
  
  /* Typography */
  --font-display: 'Anton', 'Impact', sans-serif;
  --font-mono: 'Space Mono', 'Courier New', monospace;
  --font-script: 'Caveat', cursive;
  
  /* Sizing */
  --border-width: 2.5px;
  --spacing-unit: 1rem;
}
```

---

## Scaling to a SaaS Product

This system is designed to grow. Here's how to think about expansion:

### Adding New Colors

Before adding a color, answer:
1. What semantic meaning does it carry?
2. Is there an existing color that could work?
3. What's its relationship to the current palette?

If you must add:
- Keep it in the same saturation/brightness family
- Define its semantic role immediately
- Test it against all existing colors for harmony
- Add it to the "Safe pairings" list after contrast testing

### Adding New Components

The component library should grow in **layers**:

**Layer 1: Primitives** (we have these)
- Buttons, inputs, cards, badges, icons

**Layer 2: Compositions** (build as needed)
- Form groups, card grids, navigation bars
- Built from Layer 1, no new visual language

**Layer 3: Patterns** (emerge from usage)
- Onboarding flows, settings panels, data tables
- Documented when used 3+ times

**Layer 4: Templates** (for rapid development)
- Full page layouts, common views
- Marketing pages, dashboards, auth screens

### Theming Considerations

This system assumes a single, opinionated theme. If you need variations:

**Dark Mode (if required)**
- Flip `--cream-white` and `--ink` roles
- Desaturate accents slightly for eye comfort
- Maintain border weight—don't thin them
- Keep the personality—dark ≠ serious

**Brand Variations**
- Swap accent colors while keeping structure
- The border weight and typography ARE the brand
- If you change those, it's a different system

### Feature-Specific Guidance

**Data-Heavy Views**
- Use `--bg-periwinkle` for alternating rows
- Keep borders but can reduce to 2px for density
- Accent colors for status indicators only
- Space Mono is your friend here

**Empty States**
- Perfect place for Caveat annotations
- Use illustrative sparkles/decorations
- Keep the energy—empty isn't sad

**Error States**
- `--coral-red` with `--cream-white` text
- Borders get thicker (3px) for urgency
- Clear, actionable copy
- Don't punish—guide

**Success Moments**
- `--forest-green` backgrounds
- This is a celebration—use sparkles
- Caveat annotations shine here ("Nice work!")

**Loading States**
- Pulse animations on `--bg-periwinkle` cards
- Keep borders visible during load
- Progress feels better than spinners

### Team Adoption

**For Designers**
- Start with the Figma/design tool library (build one!)
- Use the actual CSS variable names in your designs
- Annotate specs with token names, not hex values
- When in doubt, refer to this document

**For Developers**
- Import the CSS variables globally
- Build components that consume tokens
- Don't hardcode colors—ever
- Create a component library that enforces patterns

**For Product**
- Reference this doc in feature specs
- "Use the standard card pattern" > describing from scratch
- Ask "does this feel like *us*?" in reviews

---

## Living Document

This system should evolve. Update it when:

- A new pattern is used 3+ times
- A rule consistently gets broken for good reasons
- The product's needs genuinely change
- Someone asks "where's the guidance on X?"

Don't update it:
- For one-off experiments
- Before validating the change works
- Without team discussion on significant changes

---

## Quick Reference

```css
/* Import fonts */
@import url('https://fonts.googleapis.com/css2?family=Anton&family=Space+Mono:ital,wght@0,400;0,700;1,400&family=Caveat:wght@600&display=swap');

/* Core variables */
:root {
  /* Backgrounds */
  --cream-white: #F5F2ED;
  --bg-periwinkle: #B8C8DC;
  --ink: #1a1a1a;
  
  /* Accents */
  --cobalt-blue: #2B4FD6;
  --forest-green: #1B6B4D;
  --coral-red: #E94E3D;
  --sunny-yellow: #F7C948;
  --deep-purple: #5B4BB5;
  --blush-pink: #F5C4C0;
  
  /* Typography */
  --font-display: 'Anton', 'Impact', sans-serif;
  --font-mono: 'Space Mono', 'Courier New', monospace;
  --font-script: 'Caveat', cursive;
  
  /* Sizing */
  --border-width: 2.5px;
  --spacing-unit: 1rem;
}
```

---

*Last updated: February 2026*  
*Version: 1.1 — Added vibes, principles, scaling guidance*
