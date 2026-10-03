import React, { useEffect, useRef, useState } from "react";
import { useEditor, EditorContent } from "@tiptap/react";
import { Extension, Node, Mark, mergeAttributes } from "@tiptap/core";
import StarterKit from "@tiptap/starter-kit";
import TiptapImage from "@tiptap/extension-image";
import { marked } from "marked";
import DOMPurify from "dompurify";
import {Button,IconButton,Segments} from './ui';
import {Bold,Italic,List,ListOrdered,Undo,Redo} from 'lucide-react';
const Styles = Extension.create({
  name: "preserveStyles",
  addGlobalAttributes() {
    return [
      {
        types: [
          "paragraph",
          "heading",
          "image",
          "blockquote",
          "bulletList",
          "orderedList",
          "listItem",
          "codeBlock",
          "section",
        ],
        attributes: {
          style: {
            default: null,
            parseHTML: (el) => el.getAttribute("style"),
            renderHTML: (attrs) => (attrs.style ? { style: attrs.style } : {}),
          },
        },
      },
    ];
  },
});
const Section = Node.create({
  name: "section",
  group: "block",
  content: "block+",
  parseHTML() {
    return [{ tag: "section" }];
  },
  renderHTML({ HTMLAttributes }) {
    return ["section", HTMLAttributes, 0];
  },
});
const StyledSpan = Mark.create({
  name: "styledSpan",
  addAttributes() {
    return { style: { default: null } };
  },
  parseHTML() {
    return [{ tag: "span[style]" }];
  },
  renderHTML({ HTMLAttributes }) {
    return ["span", mergeAttributes(HTMLAttributes), 0];
  },
});
const html = (body) =>
  DOMPurify.sanitize(marked.parse(body || ""), {
    FORBID_TAGS: ["script", "style", "iframe", "form", "input"],
    FORBID_ATTR: ["contenteditable"],
  });
export default function RichEditor({ body, onChange, imageMap, editorRef }) {
  const [mode, setMode] = useState("visual");
  const callback = useRef(onChange);
  callback.current = onChange;
  const images = useRef(imageMap);
  images.current = imageMap;
  const last = useRef(body);
  const editor = useEditor({
    extensions: [
      StarterKit.configure({ link: { openOnClick: false } }),
      Styles,
      Section,
      StyledSpan,
      TiptapImage.extend({
        addNodeView() {
          return ({ node }) => {
            const dom = document.createElement("img");
            function render(n) {
              dom.src = images.current[n.attrs.src] || "";
              dom.alt = n.attrs.alt || "";
              dom.style.cssText = n.attrs.style || "";
              dom.style.maxWidth = "100%";
              dom.style.height = "auto";
            }
            render(node);
            return {
              dom,
              update(n) {
                if (n.type.name !== "image") return false;
                render(n);
                return true;
              },
            };
          };
        },
      }).configure({ inline: true }),
    ],
    content: html(body),
    editorProps: {
      attributes: {
        class: "rich-document",
        "aria-label": "可视化正文编辑器",
        role: "textbox",
        "aria-multiline": "true",
      },
      transformPastedHTML: (content) => DOMPurify.sanitize(content),
    },
    onUpdate: ({ editor: e }) => {
      const value = e.getHTML();
      last.current = value;
      callback.current(value);
    },
  });
  useEffect(() => {
    if (editor && body !== last.current) {
      last.current = body;
      editor.commands.setContent(html(body), { emitUpdate: false });
    }
  }, [body, editor]);
  useEffect(() => {
    editorRef.current =
      mode === "visual"
        ? {
            insertImage: (a) =>
              editor
                ?.chain()
                .focus()
                .setImage({ src: a.ref, alt: a.name })
                .run(),
          }
        : null;
    return () => {
      editorRef.current = null;
    };
  }, [editor, mode]);
  const actions = [
    ["加粗", Bold, () => editor.chain().focus().toggleBold().run()],
    ["斜体", Italic, () => editor.chain().focus().toggleItalic().run()],
    [
      "无序列表",
      List,
      () => editor.chain().focus().toggleBulletList().run(),
    ],
    [
      "有序列表",
      ListOrdered,
      () => editor.chain().focus().toggleOrderedList().run(),
    ],
    ["撤销", Undo, () => editor.chain().focus().undo().run()],
    ["重做", Redo, () => editor.chain().focus().redo().run()],
  ];
  return <div className="rich-editor"><div className="rich-toolbar"><Segments value={mode} onChange={setMode} options={[{label:'正文',value:'visual'},{label:'源码',value:'source'}]}/>{mode==='visual'&&<div className="toolbar-actions">{actions.map(([label,Icon,fn])=><IconButton key={label} label={label} icon={Icon} disabled={!editor} onClick={fn}/>)}<Button variant="ghost" onClick={()=>editor?.chain().focus().toggleHeading({level:2}).run()}>H2</Button></div>}</div>{mode==='visual'?<EditorContent editor={editor}/>:<textarea className="source-editor" ref={editorRef} value={body} onChange={e=>onChange(e.target.value)} aria-label="正文源码"/>}</div>;
}
