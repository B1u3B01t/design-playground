"use client"

import * as React from "react"
// FloatingPortal was used previously to render the dropdown at the document
// level. The dropdown now renders inside the inline-reference container so
// it inherits parent transforms (e.g. canvas zoom), so the import is unused.

import { cn } from "@/lib/utils"

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type TextSegment = {
  type: "text"
  value: string
}

type ReferenceSegment = {
  type: "reference"
  trigger: string
  value: string
  label: string
  data?: Record<string, unknown>
}

type Segment = TextSegment | ReferenceSegment

type InlineReferenceItemData = {
  id: string
  label: string
  [key: string]: unknown
}

type TriggerState = {
  trigger: string
  query: string
  /** Pixel rect of the trigger character for popup positioning */
  rect: DOMRect | null
} | null

// ---------------------------------------------------------------------------
// Context
// ---------------------------------------------------------------------------

type InlineReferenceContextValue = {
  segments: Segment[]
  setSegments: React.Dispatch<React.SetStateAction<Segment[]>>
  triggerState: TriggerState
  setTriggerState: React.Dispatch<React.SetStateAction<TriggerState>>
  activeIndex: number
  setActiveIndex: React.Dispatch<React.SetStateAction<number>>
  inputRef: React.RefObject<HTMLDivElement | null>
  selectItem: (trigger: string, item: InlineReferenceItemData) => void
  registeredTriggers: Set<string>
  registerTrigger: (trigger: string) => void
  unregisterTrigger: (trigger: string) => void
  listId: string
}

const InlineReferenceContext =
  React.createContext<InlineReferenceContextValue | null>(null)

function useInlineReferenceContext() {
  const context = React.useContext(InlineReferenceContext)
  if (!context) {
    throw new Error(
      "InlineReference components must be used within <InlineReference>"
    )
  }
  return context
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const ZERO_WIDTH_SPACE = "\u200B"
const PILL_ATTR = "data-inline-ref"
const PILL_TRIGGER_ATTR = "data-inline-ref-trigger"
const PILL_VALUE_ATTR = "data-inline-ref-value"
const PILL_LABEL_ATTR = "data-inline-ref-label"
const PILL_DATA_ATTR = "data-inline-ref-data"

/** Read segments from the contenteditable DOM. */
function readSegmentsFromDOM(el: HTMLDivElement): Segment[] {
  const segments: Segment[] = []
  const nodes = el.childNodes

  for (let i = 0; i < nodes.length; i++) {
    const node = nodes[i]

    if (node.nodeType === Node.TEXT_NODE) {
      const text = node.textContent ?? ""
      // Filter out lone zero-width spaces
      if (text && text !== ZERO_WIDTH_SPACE) {
        const cleaned = text.replace(new RegExp(ZERO_WIDTH_SPACE, "g"), "")
        if (cleaned) {
          segments.push({ type: "text", value: cleaned })
        }
      }
    } else if (node.nodeType === Node.ELEMENT_NODE) {
      const element = node as HTMLElement
      if (element.hasAttribute(PILL_ATTR)) {
        const trigger = element.getAttribute(PILL_TRIGGER_ATTR) ?? ""
        const value = element.getAttribute(PILL_VALUE_ATTR) ?? ""
        const label = element.getAttribute(PILL_LABEL_ATTR) ?? ""
        const dataStr = element.getAttribute(PILL_DATA_ATTR)
        let data: Record<string, unknown> | undefined
        if (dataStr) {
          try {
            data = JSON.parse(dataStr)
          } catch {
            // ignore
          }
        }
        segments.push({ type: "reference", trigger, value, label, data })
      } else {
        // For any other element (e.g. <br>), read text content
        const text = element.textContent ?? ""
        if (text && text !== ZERO_WIDTH_SPACE) {
          segments.push({ type: "text", value: text })
        }
      }
    }
  }

  return segments
}

/** Create a pill DOM element for a reference segment. */
function createPillElement(
  segment: ReferenceSegment,
  onDelete: () => void
): HTMLSpanElement {
  const pill = document.createElement("span")
  pill.setAttribute(PILL_ATTR, "")
  pill.setAttribute(PILL_TRIGGER_ATTR, segment.trigger)
  pill.setAttribute(PILL_VALUE_ATTR, segment.value)
  pill.setAttribute(PILL_LABEL_ATTR, segment.label)
  if (segment.data) {
    pill.setAttribute(PILL_DATA_ATTR, JSON.stringify(segment.data))
  }
  pill.contentEditable = "false"
  pill.className =
    "inline-reference-pill inline-flex items-center gap-0.5 rounded-sm bg-accent/50 border border-accent px-1.5 py-0.5 text-sm font-medium align-baseline mx-0.5 select-all whitespace-nowrap"

  const labelSpan = document.createElement("span")
  labelSpan.textContent = `${segment.trigger}${segment.label}`
  labelSpan.className = "pointer-events-none"
  pill.appendChild(labelSpan)

  const deleteBtn = document.createElement("span")
  deleteBtn.role = "button"
  deleteBtn.tabIndex = -1
  deleteBtn.ariaLabel = `Remove ${segment.label}`
  deleteBtn.className =
    "inline-flex items-center justify-center size-3.5 rounded-sm opacity-50 hover:opacity-100 cursor-pointer hover:bg-accent transition-opacity ml-0.5"
  deleteBtn.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>`
  deleteBtn.addEventListener("mousedown", (e) => {
    e.preventDefault()
    e.stopPropagation()
    onDelete()
  })
  pill.appendChild(deleteBtn)

  return pill
}

/** Detect if there's an active trigger behind the cursor. */
function detectTrigger(
  el: HTMLDivElement,
  triggers: Set<string>
): TriggerState {
  const selection = window.getSelection()
  if (!selection || selection.rangeCount === 0) return null
  const range = selection.getRangeAt(0)
  if (!range.collapsed) return null

  const node = range.startContainer
  if (node.nodeType !== Node.TEXT_NODE) return null
  const text = node.textContent ?? ""
  const cursorOffset = range.startOffset

  // Walk backwards from cursor to find a trigger character
  const textBefore = text.slice(0, cursorOffset)

  for (const trigger of triggers) {
    const lastTriggerIdx = textBefore.lastIndexOf(trigger)
    if (lastTriggerIdx === -1) continue

    // Trigger must be at start of text or preceded by whitespace
    if (
      lastTriggerIdx > 0 &&
      !/\s/.test(textBefore[lastTriggerIdx - 1])
    ) {
      continue
    }

    // Query is everything between trigger and cursor
    const query = textBefore.slice(lastTriggerIdx + trigger.length)

    // No spaces allowed in query (for now, simple matching)
    if (/\s/.test(query)) continue

    // Get position of the trigger character for popup placement
    const triggerRange = document.createRange()
    triggerRange.setStart(node, lastTriggerIdx)
    triggerRange.setEnd(node, lastTriggerIdx + trigger.length)
    const rect = triggerRange.getBoundingClientRect()

    return { trigger, query, rect }
  }

  return null
}

/** Place cursor after a given node inside the contenteditable. */
function placeCursorAfter(node: Node) {
  const selection = window.getSelection()
  if (!selection) return
  const range = document.createRange()
  range.setStartAfter(node)
  range.collapse(true)
  selection.removeAllRanges()
  selection.addRange(range)
}

// ---------------------------------------------------------------------------
// InlineReference (Root)
// ---------------------------------------------------------------------------

type InlineReferenceProps = {
  children: React.ReactNode
  value?: Segment[]
  onValueChange?: (segments: Segment[]) => void
  className?: string
}

function InlineReference({
  children,
  value,
  onValueChange,
  className,
  ...props
}: InlineReferenceProps & Omit<React.ComponentProps<"div">, "value">) {
  const [internalSegments, setInternalSegments] = React.useState<Segment[]>(
    value ?? []
  )
  const [triggerState, setTriggerState] = React.useState<TriggerState>(null)
  const [activeIndex, setActiveIndex] = React.useState(0)
  const inputRef = React.useRef<HTMLDivElement | null>(null)
  const [registeredTriggers] = React.useState(() => new Set<string>())
  const listId = React.useId()

  const isControlled = value !== undefined
  const segments = isControlled ? value : internalSegments

  const setSegments: React.Dispatch<React.SetStateAction<Segment[]>> =
    React.useCallback(
      (action) => {
        const next =
          typeof action === "function"
            ? action(isControlled ? value! : internalSegments)
            : action
        if (!isControlled) {
          setInternalSegments(next)
        }
        onValueChange?.(next)
      },
      [isControlled, value, internalSegments, onValueChange]
    )

  const selectItem = React.useCallback(
    (trigger: string, item: InlineReferenceItemData) => {
      const el = inputRef.current
      if (!el || !triggerState) return

      const selection = window.getSelection()
      if (!selection || selection.rangeCount === 0) return
      const range = selection.getRangeAt(0)
      const node = range.startContainer
      if (node.nodeType !== Node.TEXT_NODE) return

      const text = node.textContent ?? ""
      const cursorOffset = range.startOffset
      const textBefore = text.slice(0, cursorOffset)
      const triggerIdx = textBefore.lastIndexOf(trigger)
      if (triggerIdx === -1) return

      // Split the text node: before trigger, and after cursor
      const beforeText = text.slice(0, triggerIdx)
      const afterText = text.slice(cursorOffset)

      const segment: ReferenceSegment = {
        type: "reference",
        trigger,
        value: item.id,
        label: item.label,
        data: { ...item },
      }

      // Replace in DOM
      const parent = node.parentNode!
      const frag = document.createDocumentFragment()

      if (beforeText) {
        frag.appendChild(document.createTextNode(beforeText))
      }

      const deletePill = () => {
        pill.remove()
        // Sync segments
        setSegments(readSegmentsFromDOM(el))
        el.focus()
      }
      const pill = createPillElement(segment, deletePill)
      frag.appendChild(pill)

      // Add zero-width space after pill for cursor placement
      const afterNode = document.createTextNode(
        afterText ? afterText : ZERO_WIDTH_SPACE
      )
      frag.appendChild(afterNode)

      parent.replaceChild(frag, node)

      // Place cursor after the pill
      placeCursorAfter(pill)

      // Sync
      setTriggerState(null)
      setActiveIndex(0)
      setSegments(readSegmentsFromDOM(el))
    },
    [triggerState, setSegments]
  )

  const registerTrigger = React.useCallback(
    (trigger: string) => {
      registeredTriggers.add(trigger)
    },
    [registeredTriggers]
  )

  const unregisterTrigger = React.useCallback(
    (trigger: string) => {
      registeredTriggers.delete(trigger)
    },
    [registeredTriggers]
  )

  const contextValue = React.useMemo<InlineReferenceContextValue>(
    () => ({
      segments,
      setSegments,
      triggerState,
      setTriggerState,
      activeIndex,
      setActiveIndex,
      inputRef,
      selectItem,
      registeredTriggers,
      registerTrigger,
      unregisterTrigger,
      listId,
    }),
    [
      segments,
      setSegments,
      triggerState,
      activeIndex,
      selectItem,
      registeredTriggers,
      registerTrigger,
      unregisterTrigger,
      listId,
    ]
  )

  return (
    <InlineReferenceContext.Provider value={contextValue}>
      <div
        data-slot="inline-reference"
        className={cn("relative", className)}
        {...props}
      >
        {children}
      </div>
    </InlineReferenceContext.Provider>
  )
}

// ---------------------------------------------------------------------------
// InlineReferenceInput
// ---------------------------------------------------------------------------

type InlineReferenceInputProps = {
  placeholder?: string
  className?: string
} & Omit<React.ComponentProps<"div">, "contentEditable" | "role">

function InlineReferenceInput({
  placeholder,
  className,
  ...props
}: InlineReferenceInputProps) {
  const {
    setSegments,
    triggerState,
    setTriggerState,
    activeIndex,
    setActiveIndex,
    inputRef,
    selectItem,
    registeredTriggers,
    listId,
  } = useInlineReferenceContext()

  const isComposing = React.useRef(false)
  const [isEmpty, setIsEmpty] = React.useState(true)

  // Expose a way for InlineReferenceContent to register its filtered items
  // We use a global map on the context
  const itemsMapRef = React.useRef<
    Map<string, InlineReferenceItemData[]>
  >(new Map())

  // Expose this ref on the window for InlineReferenceContent to access
  React.useEffect(() => {
    const el = inputRef.current
    if (el) {
      ;(el as HTMLDivElement & { __itemsMapRef?: typeof itemsMapRef }).__itemsMapRef = itemsMapRef
    }
  }, [inputRef])

  const checkEmpty = React.useCallback(() => {
    const el = inputRef.current
    if (!el) return
    const text = el.textContent ?? ""
    const hasOnlyZWS = text.replace(new RegExp(ZERO_WIDTH_SPACE, "g"), "").trim() === ""
    const hasPills = el.querySelector(`[${PILL_ATTR}]`) !== null
    setIsEmpty(hasOnlyZWS && !hasPills)
  }, [inputRef])

  const handleInput = React.useCallback(() => {
    if (isComposing.current) return
    const el = inputRef.current
    if (!el) return

    checkEmpty()

    // Detect trigger
    const state = detectTrigger(el, registeredTriggers)
    setTriggerState(state)
    if (state) {
      setActiveIndex(0)
    }

    // Sync segments
    setSegments(readSegmentsFromDOM(el))
  }, [inputRef, registeredTriggers, setTriggerState, setActiveIndex, setSegments, checkEmpty])

  const handleKeyDown = React.useCallback(
    (e: React.KeyboardEvent<HTMLDivElement>) => {
      const el = inputRef.current
      if (!el) return

      if (triggerState) {
        const items = itemsMapRef.current.get(triggerState.trigger) ?? []
        const count = items.length

        if (e.key === "ArrowDown") {
          e.preventDefault()
          setActiveIndex((prev) => (prev + 1) % Math.max(count, 1))
          return
        }

        if (e.key === "ArrowUp") {
          e.preventDefault()
          setActiveIndex((prev) =>
            prev <= 0 ? Math.max(count - 1, 0) : prev - 1
          )
          return
        }

        if (e.key === "Enter" || e.key === "Tab") {
          if (count > 0) {
            e.preventDefault()
            const item = items[activeIndex]
            if (item) {
              selectItem(triggerState.trigger, item)
            }
          }
          return
        }

        if (e.key === "Escape") {
          e.preventDefault()
          setTriggerState(null)
          return
        }
      }

      // Handle backspace into pill
      if (e.key === "Backspace") {
        const selection = window.getSelection()
        if (!selection || selection.rangeCount === 0) return
        const range = selection.getRangeAt(0)
        if (!range.collapsed) return

        const node = range.startContainer
        const cursorOffset = range.startOffset

        // Check if cursor is right after a pill (in a text node with offset 0 or 1 for ZWS)
        if (
          node.nodeType === Node.TEXT_NODE &&
          cursorOffset <= 1
        ) {
          const prev = node.previousSibling
          if (prev && (prev as HTMLElement).hasAttribute?.(PILL_ATTR)) {
            e.preventDefault()
            prev.remove()
            setSegments(readSegmentsFromDOM(el))
            checkEmpty()
            return
          }
        }

        // If cursor is at element level right after a pill
        if (node === el && cursorOffset > 0) {
          const prev = el.childNodes[cursorOffset - 1]
          if (prev && (prev as HTMLElement).hasAttribute?.(PILL_ATTR)) {
            e.preventDefault()
            prev.remove()
            setSegments(readSegmentsFromDOM(el))
            checkEmpty()
            return
          }
        }
      }
    },
    [
      inputRef,
      triggerState,
      activeIndex,
      selectItem,
      setActiveIndex,
      setTriggerState,
      setSegments,
      checkEmpty,
    ]
  )

  const handlePaste = React.useCallback(
    (e: React.ClipboardEvent<HTMLDivElement>) => {
      e.preventDefault()
      const text = e.clipboardData.getData("text/plain")
      document.execCommand("insertText", false, text)
    },
    []
  )

  const handleCompositionStart = React.useCallback(() => {
    isComposing.current = true
  }, [])

  const handleCompositionEnd = React.useCallback(() => {
    isComposing.current = false
    handleInput()
  }, [handleInput])

  const handleBlur = React.useCallback(() => {
    setTriggerState(null)
  }, [setTriggerState])

  // Set up initial content if needed
  React.useEffect(() => {
    checkEmpty()
  }, [checkEmpty])

  const isOpen = triggerState !== null

  return (
    <div className="relative" data-slot="inline-reference-input-wrapper">
      <div
        ref={inputRef}
        data-slot="inline-reference-input"
        contentEditable
        suppressContentEditableWarning
        role="combobox"
        aria-expanded={isOpen}
        aria-autocomplete="list"
        aria-controls={isOpen ? listId : undefined}
        aria-haspopup="listbox"
        className={cn(
          "border-input placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-ring/50 aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive dark:bg-input/30 min-h-[80px] w-full rounded-md border bg-transparent px-3 py-2 text-base shadow-xs transition-[color,box-shadow] outline-none focus-visible:ring-[3px] disabled:cursor-not-allowed disabled:opacity-50 md:text-sm",
          "whitespace-pre-wrap wrap-break-word",
          className
        )}
        data-placeholder={placeholder}
        onInput={handleInput}
        onKeyDown={handleKeyDown}
        onPaste={handlePaste}
        onCompositionStart={handleCompositionStart}
        onCompositionEnd={handleCompositionEnd}
        onBlur={handleBlur}
        {...props}
      />
      {isEmpty && placeholder && (
        <div
          className="pointer-events-none absolute left-3 top-2 text-muted-foreground text-base md:text-sm select-none"
          aria-hidden
        >
          {placeholder}
        </div>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// InlineReferenceContent
// ---------------------------------------------------------------------------

type InlineReferenceContentProps = {
  trigger: string
  items: InlineReferenceItemData[]
  filterFn?: (item: InlineReferenceItemData, query: string) => boolean
  children: React.ReactNode
  className?: string
}

function InlineReferenceContent({
  trigger,
  items,
  filterFn,
  children,
  className,
}: InlineReferenceContentProps) {
  const {
    triggerState,
    registerTrigger,
    unregisterTrigger,
    inputRef,
    listId,
  } = useInlineReferenceContext()

  // Register this trigger
  React.useEffect(() => {
    registerTrigger(trigger)
    return () => unregisterTrigger(trigger)
  }, [trigger, registerTrigger, unregisterTrigger])

  const isActive = triggerState?.trigger === trigger
  const query = triggerState?.query ?? ""

  // Filter items
  const defaultFilter = React.useCallback(
    (item: InlineReferenceItemData, q: string) =>
      item.label.toLowerCase().includes(q.toLowerCase()),
    []
  )
  const filter = filterFn ?? defaultFilter
  const filteredItems = React.useMemo(
    () => (query ? items.filter((item) => filter(item, query)) : items),
    [items, query, filter]
  )

  // Register filtered items on the input element for keyboard nav
  React.useEffect(() => {
    const el = inputRef.current
    if (!el) return
    const mapRef = (
      el as HTMLDivElement & {
        __itemsMapRef?: React.RefObject<Map<string, InlineReferenceItemData[]>>
      }
    ).__itemsMapRef
    if (mapRef?.current) {
      mapRef.current.set(trigger, filteredItems)
    }
    return () => {
      if (mapRef?.current) {
        mapRef.current.delete(trigger)
      }
    }
  }, [trigger, filteredItems, inputRef])
  const [positionStyle, setPositionStyle] =
    React.useState<React.CSSProperties | null>(null)

  // Position the dropdown relative to the trigger/cursor rect,
  // but inside the inline-reference container so it inherits any
  // parent transforms (e.g. React Flow canvas zoom).
  React.useEffect(() => {
    if (!isActive || !triggerState?.rect) {
      setPositionStyle(null)
      return
    }

    const el = inputRef.current
    if (!el) {
      setPositionStyle(null)
      return
    }

    const rect = triggerState.rect
    const containerRect = el.getBoundingClientRect()
    const margin = 8
    const estimatedWidth = 280

    // Base position: just under the trigger, relative to the container
    const top = rect.bottom - containerRect.top + 4
    let left = rect.left - containerRect.left

    const containerWidth = containerRect.width

    // Keep within container horizontally
    if (left + estimatedWidth + margin > containerWidth) {
      left = Math.max(margin, containerWidth - estimatedWidth - margin)
    } else {
      left = Math.max(margin, left)
    }

    setPositionStyle({
      position: "absolute",
      top,
      left,
      maxWidth: estimatedWidth + 40,
      zIndex: 50,
    })
  }, [isActive, triggerState, inputRef])

  if (!isActive) return null

  return (
    <div
      data-slot="inline-reference-content"
      role="listbox"
      id={listId}
      aria-label={`Suggestions for ${trigger}`}
      style={positionStyle ?? undefined}
      className={cn(
        "bg-popover text-popover-foreground z-50 min-w-[200px] overflow-hidden rounded-md border shadow-md",
        "animate-in fade-in-0 zoom-in-95 slide-in-from-top-2",
        className
      )}
    >
      <InlineReferenceContentContext.Provider
        value={{ filteredItems, trigger }}
      >
        {children}
      </InlineReferenceContentContext.Provider>
    </div>
  )
}

// Content-level context to pass filtered items to List
type InlineReferenceContentContextValue = {
  filteredItems: InlineReferenceItemData[]
  trigger: string
}

const InlineReferenceContentContext =
  React.createContext<InlineReferenceContentContextValue | null>(null)

function useInlineReferenceContentContext() {
  const context = React.useContext(InlineReferenceContentContext)
  if (!context) {
    throw new Error(
      "InlineReferenceList/Item must be used within <InlineReferenceContent>"
    )
  }
  return context
}

// ---------------------------------------------------------------------------
// InlineReferenceList
// ---------------------------------------------------------------------------

type InlineReferenceListProps = {
  children: (item: InlineReferenceItemData) => React.ReactNode
  className?: string
}

function InlineReferenceList({
  children,
  className,
}: InlineReferenceListProps) {
  const { filteredItems } = useInlineReferenceContentContext()

  return (
    <div
      data-slot="inline-reference-list"
      className={cn("max-h-[300px] overflow-y-auto p-1", className)}
    >
      {filteredItems.map((item) => children(item))}
    </div>
  )
}

// ---------------------------------------------------------------------------
// InlineReferenceItem
// ---------------------------------------------------------------------------

type InlineReferenceItemProps = {
  value: InlineReferenceItemData
  children: React.ReactNode
  className?: string
} & Omit<React.ComponentProps<"div">, "value">

function InlineReferenceItem({
  value,
  children,
  className,
  ...props
}: InlineReferenceItemProps) {
  const { activeIndex, setActiveIndex, selectItem } =
    useInlineReferenceContext()
  const { filteredItems, trigger } = useInlineReferenceContentContext()

  const index = filteredItems.indexOf(value)
  const isActive = index === activeIndex
  const itemId = `inline-ref-item-${value.id}`

  const description =
    typeof (value as InlineReferenceItemData & { description?: unknown })
      .description === "string"
      ? (value as InlineReferenceItemData & { description?: string })
          .description
      : undefined

  const handleMouseDown = React.useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault()
      selectItem(trigger, value)
    },
    [trigger, value, selectItem]
  )

  const handleMouseEnter = React.useCallback(() => {
    setActiveIndex(index)
  }, [index, setActiveIndex])

  return (
    <div
      data-slot="inline-reference-item"
      id={itemId}
      role="option"
      aria-selected={isActive}
      data-selected={isActive}
      title={description}
      className={cn(
        "data-[selected=true]:bg-accent data-[selected=true]:text-accent-foreground relative flex cursor-default items-center gap-2 rounded-sm px-2 py-1.5 text-sm outline-hidden select-none data-[disabled=true]:pointer-events-none data-[disabled=true]:opacity-50 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
        className
      )}
      onMouseDown={handleMouseDown}
      onMouseEnter={handleMouseEnter}
      {...props}
    >
      {children}
    </div>
  )
}

// ---------------------------------------------------------------------------
// InlineReferenceEmpty
// ---------------------------------------------------------------------------

type InlineReferenceEmptyProps = {
  children: React.ReactNode
  className?: string
}

function InlineReferenceEmpty({
  children,
  className,
}: InlineReferenceEmptyProps) {
  const { filteredItems } = useInlineReferenceContentContext()

  if (filteredItems.length > 0) return null

  return (
    <div
      data-slot="inline-reference-empty"
      className={cn("py-6 text-center text-sm text-muted-foreground", className)}
    >
      {children}
    </div>
  )
}

// ---------------------------------------------------------------------------
// InlineReferenceGroup
// ---------------------------------------------------------------------------

type InlineReferenceGroupProps = {
  heading?: string
  children: React.ReactNode
  className?: string
}

function InlineReferenceGroup({
  heading,
  children,
  className,
}: InlineReferenceGroupProps) {
  return (
    <div
      data-slot="inline-reference-group"
      className={cn("overflow-hidden p-1", className)}
    >
      {heading && (
        <div className="text-muted-foreground px-2 py-1.5 text-xs font-medium">
          {heading}
        </div>
      )}
      {children}
    </div>
  )
}

// ---------------------------------------------------------------------------
// InlineReferenceSeparator
// ---------------------------------------------------------------------------

function InlineReferenceSeparator({
  className,
  ...props
}: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="inline-reference-separator"
      className={cn("bg-border -mx-1 h-px", className)}
      {...props}
    />
  )
}

// ---------------------------------------------------------------------------
// Exports
// ---------------------------------------------------------------------------

export {
  InlineReference,
  InlineReferenceInput,
  InlineReferenceContent,
  InlineReferenceList,
  InlineReferenceItem,
  InlineReferenceEmpty,
  InlineReferenceGroup,
  InlineReferenceSeparator,
}

export type {
  Segment,
  TextSegment,
  ReferenceSegment,
  InlineReferenceItemData,
}
