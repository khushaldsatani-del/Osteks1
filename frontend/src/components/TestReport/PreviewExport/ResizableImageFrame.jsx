import React, { useRef, useState } from "react";
import { AlignLeft, AlignCenter, AlignRight } from "lucide-react";

const ALIGN_ICONS = [
  { value: "left", Icon: AlignLeft, title: "Align left" },
  { value: "center", Icon: AlignCenter, title: "Align center" },
  { value: "right", Icon: AlignRight, title: "Align right" },
];

// One resizable, alignable photo inside a document photo box — drag the
// bottom-right corner to resize, or pick left/center/right to move it
// within its own cell, the same two things an inline picture inside a Word
// table cell supports. Both are scoped to this one cell: resizing can't
// grow a photo into its neighbor's column, and alignment only shifts it
// left/right *inside* that same column — never a free position on the page.
//
// The drag itself writes directly to the frame's own DOM node (via
// frameRef), not React state, so dragging is a plain, jank-free CSS resize
// with no re-render — and, crucially, no repagination — on every
// pointermove. Only the FINAL width, committed on pointerup, is reported
// upward (onResize), which is what actually persists the resize and
// re-triggers the document's real pagination pass.
const ResizableImageFrame = ({ src, width, height, ratio, minWidth, maxWidth, align, onResize, onReset, onAlign }) => {
  const frameRef = useRef(null);
  const dragRef = useRef(null);
  const [dragging, setDragging] = useState(false);

  const handlePointerDown = (event) => {
    event.preventDefault();
    event.stopPropagation();
    event.currentTarget.setPointerCapture(event.pointerId);
    // On a phone the page is shown zoomed out (TestReportPreview's
    // pageScale), but clientX is in screen pixels while width is in page
    // pixels. Without dividing by the zoom, a drag would resize the photo far
    // less than the finger moved. Read from the page this frame is actually
    // in; it is 1 on a normal screen, so desktop dragging is unchanged.
    const page = event.currentTarget.closest(".doc-page");
    const zoom = page ? parseFloat(getComputedStyle(page).zoom) || 1 : 1;
    dragRef.current = { startX: event.clientX, startWidth: width, zoom };
    setDragging(true);
  };

  const handlePointerMove = (event) => {
    if (!dragRef.current || !frameRef.current) return;
    const delta = (event.clientX - dragRef.current.startX) / dragRef.current.zoom;
    const nextWidth = Math.max(minWidth, Math.min(maxWidth, dragRef.current.startWidth + delta));
    const nextHeight = nextWidth / ratio;
    frameRef.current.style.width = `${nextWidth}px`;
    frameRef.current.style.height = `${nextHeight}px`;
  };

  const endDrag = (event) => {
    if (!dragRef.current || !frameRef.current) return;
    if (event.currentTarget.hasPointerCapture?.(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    const finalWidth = parseFloat(frameRef.current.style.width) || width;
    dragRef.current = null;
    setDragging(false);
    onResize(finalWidth);
  };

  return (
    <div className="doc-photo-frame-wrap">
      <div className="doc-photo-toolbar" onPointerDown={(e) => e.stopPropagation()}>
        {ALIGN_ICONS.map(({ value, Icon, title }) => (
          <button
            key={value}
            type="button"
            className={`doc-photo-align-btn${align === value ? " active" : ""}`}
            title={title}
            onClick={() => onAlign(value)}
          >
            <Icon size={12} />
          </button>
        ))}
      </div>
      <div ref={frameRef} className={`doc-photo-frame${dragging ? " is-resizing" : ""}`} style={{ width, height }}>
        <img className="doc-photo-img" src={src} alt="" draggable={false} />
        <span
          className="doc-photo-resize-handle"
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={endDrag}
          onPointerCancel={endDrag}
          onDoubleClick={(event) => {
            event.stopPropagation();
            onReset();
          }}
          title="Drag to resize · double-click to reset"
        />
      </div>
    </div>
  );
};

export default ResizableImageFrame;
