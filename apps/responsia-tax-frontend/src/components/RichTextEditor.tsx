import { useCallback, useEffect, useRef } from 'react';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import LinkExtension from '@tiptap/extension-link';
import Underline from '@tiptap/extension-underline';
import { Markdown } from 'tiptap-markdown';
import { Box, IconButton, Divider, Tooltip } from '@mui/material';
import {
  FormatBold,
  FormatItalic,
  FormatUnderlined,
  StrikethroughS,
  FormatListBulleted,
  FormatListNumbered,
  FormatQuote,
  Code,
  Link as LinkIcon,
  LinkOff,
  Undo,
  Redo,
  Title,
} from '@mui/icons-material';
import './RichTextEditor.css';

export interface RichTextEditorProps {
  content: string;
  onChange: (md: string) => void;
  placeholder?: string;
  editable?: boolean;
}

export function RichTextEditor({
  content,
  onChange,
  placeholder = '',
  editable = true,
}: RichTextEditorProps) {
  const lastMarkdownRef = useRef(content);

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: { levels: [1, 2, 3] },
      }),
      Underline,
      LinkExtension.configure({
        openOnClick: false,
        HTMLAttributes: { target: '_blank', rel: 'noopener noreferrer' },
      }),
      Markdown,
    ],
    content,
    editable,
    editorProps: {
      attributes: {
        class: 'rich-text-prosemirror',
        'data-placeholder': placeholder,
      },
    },
    onUpdate: ({ editor: ed }) => {
      const md = (ed.storage as any).markdown?.getMarkdown?.() ?? ed.getText();
      lastMarkdownRef.current = md;
      onChange(md);
    },
  });

  // Sync external content changes (e.g. "copy to response")
  useEffect(() => {
    if (!editor || editor.isDestroyed) return;
    if (content !== lastMarkdownRef.current) {
      lastMarkdownRef.current = content;
      editor.commands.setContent(content);
    }
  }, [content, editor]);

  const toggleLink = useCallback(() => {
    if (!editor) return;
    if (editor.isActive('link')) {
      editor.chain().focus().unsetLink().run();
    } else {
      const url = window.prompt('URL');
      if (url) {
        editor.chain().focus().setLink({ href: url }).run();
      }
    }
  }, [editor]);

  if (!editor) return null;

  const ToolBtn = ({
    action,
    active,
    icon,
    title,
  }: {
    action: () => void;
    active?: boolean;
    icon: React.ReactNode;
    title: string;
  }) => (
    <Tooltip title={title} arrow>
      <IconButton
        size="small"
        onClick={action}
        sx={{
          borderRadius: 1,
          color: active ? 'primary.main' : 'text.secondary',
          bgcolor: active ? 'action.selected' : 'transparent',
          '&:hover': { bgcolor: 'action.hover' },
        }}
      >
        {icon}
      </IconButton>
    </Tooltip>
  );

  return (
    <Box
      className="rich-text-editor"
      sx={{
        border: '1px solid',
        borderColor: 'divider',
        borderRadius: 1,
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        '&:focus-within': {
          borderColor: 'primary.main',
          borderWidth: 2,
        },
      }}
    >
      {/* Toolbar */}
      <Box
        sx={{
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'center',
          gap: 0.25,
          px: 0.5,
          py: 0.5,
          borderBottom: '1px solid',
          borderColor: 'divider',
          bgcolor: 'grey.50',
        }}
      >
        <ToolBtn
          title="Bold (Ctrl+B)"
          icon={<FormatBold fontSize="small" />}
          active={editor.isActive('bold')}
          action={() => editor.chain().focus().toggleBold().run()}
        />
        <ToolBtn
          title="Italic (Ctrl+I)"
          icon={<FormatItalic fontSize="small" />}
          active={editor.isActive('italic')}
          action={() => editor.chain().focus().toggleItalic().run()}
        />
        <ToolBtn
          title="Underline (Ctrl+U)"
          icon={<FormatUnderlined fontSize="small" />}
          active={editor.isActive('underline')}
          action={() => editor.chain().focus().toggleUnderline().run()}
        />
        <ToolBtn
          title="Strikethrough"
          icon={<StrikethroughS fontSize="small" />}
          active={editor.isActive('strike')}
          action={() => editor.chain().focus().toggleStrike().run()}
        />

        <Divider orientation="vertical" flexItem sx={{ mx: 0.5 }} />

        <ToolBtn
          title="Heading 1"
          icon={<Title fontSize="small" />}
          active={editor.isActive('heading', { level: 1 })}
          action={() =>
            editor.chain().focus().toggleHeading({ level: 1 }).run()
          }
        />
        <ToolBtn
          title="Heading 2"
          icon={
            <Title fontSize="small" sx={{ transform: 'scale(0.85)' }} />
          }
          active={editor.isActive('heading', { level: 2 })}
          action={() =>
            editor.chain().focus().toggleHeading({ level: 2 }).run()
          }
        />
        <ToolBtn
          title="Heading 3"
          icon={
            <Title fontSize="small" sx={{ transform: 'scale(0.7)' }} />
          }
          active={editor.isActive('heading', { level: 3 })}
          action={() =>
            editor.chain().focus().toggleHeading({ level: 3 }).run()
          }
        />

        <Divider orientation="vertical" flexItem sx={{ mx: 0.5 }} />

        <ToolBtn
          title="Bullet List"
          icon={<FormatListBulleted fontSize="small" />}
          active={editor.isActive('bulletList')}
          action={() => editor.chain().focus().toggleBulletList().run()}
        />
        <ToolBtn
          title="Numbered List"
          icon={<FormatListNumbered fontSize="small" />}
          active={editor.isActive('orderedList')}
          action={() => editor.chain().focus().toggleOrderedList().run()}
        />
        <ToolBtn
          title="Blockquote"
          icon={<FormatQuote fontSize="small" />}
          active={editor.isActive('blockquote')}
          action={() => editor.chain().focus().toggleBlockquote().run()}
        />
        <ToolBtn
          title="Code"
          icon={<Code fontSize="small" />}
          active={editor.isActive('code')}
          action={() => editor.chain().focus().toggleCode().run()}
        />

        <Divider orientation="vertical" flexItem sx={{ mx: 0.5 }} />

        <ToolBtn
          title={editor.isActive('link') ? 'Remove Link' : 'Add Link'}
          icon={
            editor.isActive('link') ? (
              <LinkOff fontSize="small" />
            ) : (
              <LinkIcon fontSize="small" />
            )
          }
          active={editor.isActive('link')}
          action={toggleLink}
        />

        <Box sx={{ flex: 1 }} />

        <ToolBtn
          title="Undo (Ctrl+Z)"
          icon={<Undo fontSize="small" />}
          action={() => editor.chain().focus().undo().run()}
        />
        <ToolBtn
          title="Redo (Ctrl+Y)"
          icon={<Redo fontSize="small" />}
          action={() => editor.chain().focus().redo().run()}
        />
      </Box>

      {/* Editor content */}
      <Box sx={{ flex: 1, overflow: 'auto' }}>
        <EditorContent editor={editor} style={{ height: '100%' }} />
      </Box>
    </Box>
  );
}
