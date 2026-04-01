
## Run Locally

**Prerequisites:**  Node.js


1. Install dependencies:
   `npm install`
2. Set the `GEMINI_API_KEY` in [.env.local](.env.local) to your Gemini API key
3. Run the app:
   `npm run dev`

## Recent Updates

### CEFR Adaptive Assessment Engine - Core Stabilization
- **Dynamic Scoring Unfrozen**: The submission pipeline actively updates real-time numeric skill evaluations based on continuous evidence parsing.
- **Robust Math Execution**: Eliminated NaN confidence outputs utilizing rigid numeric bounds checking (`clamp01`, `safeDivide`). 
- **Decoupled Accuracy from Confidence**: The frontend views cleanly derive interface metrics utilizing a detached `masteryScore`, solving previously counterintuitive behavior bridging user ability and model confidence.
- **Conservative Inference Banding**: Enhanced stability against rapid upward inflation across arbitrary performance thresholds (e.g., scoring defaults to `A2+` rather than full `B1` until confidence accumulates). 
- **Humanized Growth Suggestions**: Maps raw descriptor evaluation hashes to explicit textual recommendations (via the formal CEFR catalogue).

Tests are maintained via `Vitest`. Run `npm test` to verify underlying scoring functionality logic mappings without requiring active node network access to asset files.

"# ai-language-tutor"
