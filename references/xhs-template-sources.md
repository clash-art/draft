# Longform template design references

Reviewed 2026-09-21: https://github.com/huanjuedadehen/rednote-cards
MIT license verified from checkout LICENSE; retained in rednote-cards-LICENSE.
Reviewed src/templates/article/index.tsx and src/templates/essay/index.tsx for paper backgrounds, Chinese type hierarchy and multi-page layouts. Our implementation is independent; no upstream runtime, branding, example text or decorative artwork is embedded.

Three local presets: 纸刊 (warm paper, serif headings), 研读 (blue ink, ruled section headings), 清读 (green ink, open headings). All share the full source content, browser pagination, and exact page DOM export. Preview at 360 × 480 CSS px, export at 3×. Body 14px; references 11px.
