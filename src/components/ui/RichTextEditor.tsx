import { useEditor, EditorContent } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import Underline from '@tiptap/extension-underline'
import Highlight from '@tiptap/extension-highlight'
import TextAlign from '@tiptap/extension-text-align'
import Color from '@tiptap/extension-color'
import { TextStyle } from '@tiptap/extension-text-style'
import Link from '@tiptap/extension-link'
import Placeholder from '@tiptap/extension-placeholder'
import { useEffect, useCallback } from 'react'
import { cn } from '@/lib/cn'
import {
  Bold, Italic, Underline as UnderlineIcon, Strikethrough,
  Highlighter, AlignLeft, AlignCenter, AlignRight,
  List, ListOrdered, Link as LinkIcon, Minus,
  Heading1, Heading2, Heading3, RemoveFormatting,
  Undo, Redo,
} from 'lucide-react'

interface RichTextEditorProps {
  value?: string
  onChange?: (html: string) => void
  placeholder?: string
  label?: string
  minHeight?: number
  readOnly?: boolean
  className?: string
}

const COLORS = [
  { hex: 'inherit', label: 'Padrão' },
  { hex: '#111827', label: 'Preto' },
  { hex: '#1d4ed8', label: 'Azul' },
  { hex: '#15803d', label: 'Verde' },
  { hex: '#b91c1c', label: 'Vermelho' },
  { hex: '#92400e', label: 'Marrom' },
  { hex: '#7c3aed', label: 'Roxo' },
  { hex: '#0f766e', label: 'Verde-água' },
]

const HIGHLIGHT_COLORS = [
  { hex: '#fef08a', label: 'Amarelo' },
  { hex: '#bbf7d0', label: 'Verde' },
  { hex: '#bfdbfe', label: 'Azul' },
  { hex: '#fecaca', label: 'Vermelho' },
  { hex: '#e9d5ff', label: 'Roxo' },
  { hex: '#fed7aa', label: 'Laranja' },
]

export function RichTextEditor({
  value = '',
  onChange,
  placeholder = 'Digite aqui…',
  label,
  minHeight = 120,
  readOnly = false,
  className,
}: RichTextEditorProps) {
  const editor = useEditor({
    extensions: [
      StarterKit.configure({ heading: { levels: [1, 2, 3] } }),
      Underline,
      Highlight.configure({ multicolor: true }),
      TextAlign.configure({ types: ['heading', 'paragraph'] }),
      TextStyle,
      Color,
      Link.configure({ openOnClick: false, autolink: true }),
      Placeholder.configure({ placeholder }),
    ],
    content: value,
    editable: !readOnly,
    onUpdate: ({ editor }) => {
      onChange?.(editor.getHTML())
    },
  })

  // Sincroniza valor externo (ex: carregamento do banco)
  useEffect(() => {
    if (!editor) return
    if (value !== editor.getHTML()) {
      editor.commands.setContent(value ?? '', { emitUpdate: false })
    }
  }, [value, editor])

  const setLink = useCallback(() => {
    const prev = editor?.getAttributes('link').href
    const url = window.prompt('URL do link:', prev)
    if (url === null) return
    if (url === '') { editor?.chain().focus().extendMarkRange('link').unsetLink().run(); return }
    editor?.chain().focus().extendMarkRange('link').setLink({ href: url }).run()
  }, [editor])

  if (!editor) return null

  const ToolBtn = ({
    onClick, active, title, children, disabled,
  }: { onClick: () => void; active?: boolean; title: string; children: React.ReactNode; disabled?: boolean }) => (
    <button
      type="button"
      onMouseDown={e => { e.preventDefault(); onClick() }}
      disabled={disabled}
      title={title}
      className={cn(
        'p-1.5 rounded transition-colors',
        active ? 'bg-blue-100 text-blue-700' : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900',
        disabled && 'opacity-30 cursor-not-allowed',
      )}
    >
      {children}
    </button>
  )

  const Divider = () => <div className="w-px h-5 bg-gray-200 mx-0.5" />

  return (
    <div className={cn('flex flex-col', className)}>
      {label && (
        <label className="text-sm font-medium text-gray-700 mb-1">{label}</label>
      )}

      <div className={cn(
        'border border-gray-300 rounded-lg overflow-hidden focus-within:ring-2 focus-within:ring-blue-500 focus-within:border-transparent',
        readOnly && 'bg-gray-50',
      )}>
        {/* ── Toolbar ─────────────────────────────────── */}
        {!readOnly && (
          <div className="flex flex-wrap items-center gap-0.5 px-2 py-1.5 border-b border-gray-200 bg-gray-50">

            {/* Desfazer / Refazer */}
            <ToolBtn onClick={() => editor.chain().focus().undo().run()} title="Desfazer (Ctrl+Z)" disabled={!editor.can().undo()}>
              <Undo size={14} />
            </ToolBtn>
            <ToolBtn onClick={() => editor.chain().focus().redo().run()} title="Refazer (Ctrl+Y)" disabled={!editor.can().redo()}>
              <Redo size={14} />
            </ToolBtn>

            <Divider />

            {/* Títulos */}
            <ToolBtn onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()} active={editor.isActive('heading', { level: 1 })} title="Título 1">
              <Heading1 size={14} />
            </ToolBtn>
            <ToolBtn onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()} active={editor.isActive('heading', { level: 2 })} title="Título 2">
              <Heading2 size={14} />
            </ToolBtn>
            <ToolBtn onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()} active={editor.isActive('heading', { level: 3 })} title="Título 3">
              <Heading3 size={14} />
            </ToolBtn>

            <Divider />

            {/* Formatação */}
            <ToolBtn onClick={() => editor.chain().focus().toggleBold().run()} active={editor.isActive('bold')} title="Negrito (Ctrl+B)">
              <Bold size={14} />
            </ToolBtn>
            <ToolBtn onClick={() => editor.chain().focus().toggleItalic().run()} active={editor.isActive('italic')} title="Itálico (Ctrl+I)">
              <Italic size={14} />
            </ToolBtn>
            <ToolBtn onClick={() => editor.chain().focus().toggleUnderline().run()} active={editor.isActive('underline')} title="Sublinhado (Ctrl+U)">
              <UnderlineIcon size={14} />
            </ToolBtn>
            <ToolBtn onClick={() => editor.chain().focus().toggleStrike().run()} active={editor.isActive('strike')} title="Tachado">
              <Strikethrough size={14} />
            </ToolBtn>

            <Divider />

            {/* Realce (grifar) */}
            <div className="relative group">
              <ToolBtn onClick={() => editor.chain().focus().toggleHighlight({ color: '#fef08a' }).run()} active={editor.isActive('highlight')} title="Grifar texto">
                <Highlighter size={14} />
              </ToolBtn>
              {/* Dropdown de cores de realce */}
              <div className="absolute top-full left-0 mt-1 hidden group-hover:flex flex-wrap gap-1 p-2 bg-white border border-gray-200 rounded-lg shadow-lg z-20 w-32">
                {HIGHLIGHT_COLORS.map(c => (
                  <button
                    key={c.hex}
                    type="button"
                    title={c.label}
                    onMouseDown={e => { e.preventDefault(); editor.chain().focus().toggleHighlight({ color: c.hex }).run() }}
                    className="w-6 h-6 rounded border border-gray-300 transition-transform hover:scale-110"
                    style={{ backgroundColor: c.hex }}
                  />
                ))}
                <button
                  type="button"
                  title="Remover realce"
                  onMouseDown={e => { e.preventDefault(); editor.chain().focus().unsetHighlight().run() }}
                  className="w-full text-xs text-gray-500 hover:text-red-500 mt-1"
                >
                  ✕ remover
                </button>
              </div>
            </div>

            {/* Cor do texto */}
            <div className="relative group">
              <ToolBtn onClick={() => {}} title="Cor do texto">
                <span className="text-xs font-bold" style={{ color: editor.getAttributes('textStyle').color || '#111' }}>A</span>
              </ToolBtn>
              <div className="absolute top-full left-0 mt-1 hidden group-hover:flex flex-wrap gap-1 p-2 bg-white border border-gray-200 rounded-lg shadow-lg z-20 w-32">
                {COLORS.map(c => (
                  <button
                    key={c.hex}
                    type="button"
                    title={c.label}
                    onMouseDown={e => {
                      e.preventDefault()
                      c.hex === 'inherit'
                        ? editor.chain().focus().unsetColor().run()
                        : editor.chain().focus().setColor(c.hex).run()
                    }}
                    className="w-6 h-6 rounded-full border border-gray-300 transition-transform hover:scale-110"
                    style={{ backgroundColor: c.hex === 'inherit' ? '#fff' : c.hex }}
                  />
                ))}
              </div>
            </div>

            <Divider />

            {/* Alinhamento */}
            <ToolBtn onClick={() => editor.chain().focus().setTextAlign('left').run()} active={editor.isActive({ textAlign: 'left' })} title="Alinhar esquerda">
              <AlignLeft size={14} />
            </ToolBtn>
            <ToolBtn onClick={() => editor.chain().focus().setTextAlign('center').run()} active={editor.isActive({ textAlign: 'center' })} title="Centralizar">
              <AlignCenter size={14} />
            </ToolBtn>
            <ToolBtn onClick={() => editor.chain().focus().setTextAlign('right').run()} active={editor.isActive({ textAlign: 'right' })} title="Alinhar direita">
              <AlignRight size={14} />
            </ToolBtn>

            <Divider />

            {/* Listas */}
            <ToolBtn onClick={() => editor.chain().focus().toggleBulletList().run()} active={editor.isActive('bulletList')} title="Lista com marcadores">
              <List size={14} />
            </ToolBtn>
            <ToolBtn onClick={() => editor.chain().focus().toggleOrderedList().run()} active={editor.isActive('orderedList')} title="Lista numerada">
              <ListOrdered size={14} />
            </ToolBtn>

            <Divider />

            {/* Link */}
            <ToolBtn onClick={setLink} active={editor.isActive('link')} title="Inserir link">
              <LinkIcon size={14} />
            </ToolBtn>

            {/* Linha horizontal */}
            <ToolBtn onClick={() => editor.chain().focus().setHorizontalRule().run()} title="Linha horizontal">
              <Minus size={14} />
            </ToolBtn>

            <Divider />

            {/* Limpar formatação */}
            <ToolBtn onClick={() => editor.chain().focus().clearNodes().unsetAllMarks().run()} title="Limpar formatação">
              <RemoveFormatting size={14} />
            </ToolBtn>
          </div>
        )}

        {/* ── Área de texto ───────────────────────────── */}
        <EditorContent
          editor={editor}
          className="prose prose-sm max-w-none px-3 py-2.5 focus:outline-none"
          style={{ minHeight }}
        />
      </div>
    </div>
  )
}

/** Exibe HTML salvo sem editor (somente leitura, bem formatado) */
export function RichTextView({ html, className }: { html: string; className?: string }) {
  if (!html || html === '<p></p>') return null
  return (
    <div
      className={cn('prose prose-sm max-w-none text-gray-700', className)}
      dangerouslySetInnerHTML={{ __html: html }}
    />
  )
}
