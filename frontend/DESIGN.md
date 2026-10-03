# 微信内容工作台

Reference: the user-selected `taste-saas-skill/skills/taste-saas/templates/linear` demo. `src/linear.css` is the original template; product layouts and Radix primitives are composed in `src/style.css`. Template attribution is in LINEAR-TEMPLATE-LICENSE.

Content is the entity. Its primary states are pending, linked WeChat draft, and published. Lists are compact; opening an article gives one reading/editor canvas and a contextual inspector. Preview replaces the editor rather than duplicating it. On narrow screens the inspector is a Radix dialog sheet. All article mutations retain revision protection and draft identity.

Radix handles dialogs, menus, pickers, tooltips and tabs. Lucide is the single icon family. TanStack Query caches reads and refreshes shared workspace state. Tiptap preserves imported inline styles and local image references. Ant Design is not used.

The native MCP App is a separate self-contained resource using the official ext-apps SDK. It receives rendered preview via tool result metadata, calls tools through the host, and never receives account credentials. The standalone browser cannot impersonate host message capabilities.
