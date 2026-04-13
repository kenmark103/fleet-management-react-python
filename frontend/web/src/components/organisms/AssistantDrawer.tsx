// components/organisms/AssistantDrawer.tsx
import { useMemo, useState, useRef, useCallback, useEffect } from "react";
import { Bot, Loader2, Send, Sparkles, X, GripVertical } from "lucide-react";
import { Button } from "../ui/button";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "../ui/sheet";
import { Textarea } from "../ui/textarea";
import { useAssistantChat, useAssistantSuggestions } from "../../hooks/useAssistant";
import type { AssistantMessage } from "../../types/assistant";

interface Position {
  x: number;
  y: number;
}

export function AssistantDrawer() {
  const [open, setOpen] = useState(false);
  const [sessionId, setSessionId] = useState<string | undefined>();
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<AssistantMessage[]>([]);
  
  // Draggable state
  const [position, setPosition] = useState<Position>({ x: -1, y: -1 }); // -1 = default (bottom-right)
  const [isDragging, setIsDragging] = useState(false);
  const [hasDragged, setHasDragged] = useState(false);
  
  const dragRef = useRef<HTMLDivElement>(null);
  const dragStartPos = useRef<Position>({ x: 0, y: 0 });
  const initialMousePos = useRef<Position>({ x: 0, y: 0 });
  const buttonRef = useRef<HTMLButtonElement>(null);

  const suggestions = useAssistantSuggestions();
  const chat = useAssistantChat();

  const disabled = useMemo(() => !input.trim() || chat.isPending, [input, chat.isPending]);

  // Load saved position on mount
  useEffect(() => {
    const saved = localStorage.getItem('assistant-position');
    if (saved) {
      try {
        const pos = JSON.parse(saved);
        setPosition(constrainPosition(pos.x, pos.y));
      } catch {
        setPosition({ x: window.innerWidth - 100, y: window.innerHeight - 100 });
      }
    } else {
      // Default bottom-right position
      setPosition({ x: window.innerWidth - 100, y: window.innerHeight - 100 });
    }
  }, []);

  // Save position when not dragging
  useEffect(() => {
    if (!isDragging && position.x > 0) {
      localStorage.setItem('assistant-position', JSON.stringify(position));
    }
  }, [position, isDragging]);

  // Constrain to viewport
  const constrainPosition = useCallback((x: number, y: number): Position => {
    const padding = 80; // Keep away from edges
    const buttonSize = 56;
    return {
      x: Math.max(padding, Math.min(x, window.innerWidth - buttonSize - padding)),
      y: Math.max(padding, Math.min(y, window.innerHeight - buttonSize - padding)),
    };
  }, []);

  // Handle window resize
  useEffect(() => {
    const handleResize = () => {
      setPosition(prev => constrainPosition(prev.x, prev.y));
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [constrainPosition]);

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    // Don't drag if clicking inside the sheet or on interactive elements
    if ((e.target as HTMLElement).closest('[data-sheet-content]')) return;
    
    setIsDragging(true);
    setHasDragged(false);
    dragStartPos.current = { ...position };
    initialMousePos.current = { x: e.clientX, y: e.clientY };
    e.preventDefault();
  }, [position]);

  const handleMouseMove = useCallback((e: MouseEvent) => {
    if (!isDragging) return;
    
    const deltaX = e.clientX - initialMousePos.current.x;
    const deltaY = e.clientY - initialMousePos.current.y;
    
    // Only consider it a drag if moved more than 5px
    if (Math.abs(deltaX) > 5 || Math.abs(deltaY) > 5) {
      setHasDragged(true);
    }
    
    setPosition(constrainPosition(
      dragStartPos.current.x + deltaX,
      dragStartPos.current.y + deltaY
    ));
  }, [isDragging, constrainPosition]);

  const handleMouseUp = useCallback(() => {
    setIsDragging(false);
  }, []);

  useEffect(() => {
    if (isDragging) {
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
      return () => {
        window.removeEventListener('mousemove', handleMouseMove);
        window.removeEventListener('mouseup', handleMouseUp);
      };
    }
  }, [isDragging, handleMouseMove, handleMouseUp]);

  const submit = async (prompt?: string) => {
    const message = (prompt ?? input).trim();
    if (!message) return;

    setMessages((prev) => [...prev, { id: `user-${Date.now()}`, role: "user", content: message }]);
    if (!prompt) setInput("");

    const response = await chat.mutateAsync({ message, sessionId });
    setSessionId(response.sessionId);
    setMessages((prev) => [...prev, { id: `assistant-${Date.now()}`, role: "assistant", content: response.message }]);
  };

  // Handle button click - only toggle if we didn't just finish dragging
  const handleButtonClick = useCallback(() => {
    if (!hasDragged) {
      setOpen(true);
    }
  }, [hasDragged]);

  // Calculate sheet position (anchor to button position)
  const getSheetStyle = useMemo(() => {
    if (position.x < 0) return {};
    
    const sheetWidth = 448; // max-w-xl (28rem = 448px)
    const sheetHeight = 600;
    const padding = 16;
    
    let left = position.x - sheetWidth + 60; // Align right edge with button right
    let top = position.y - sheetHeight - 20;  // Position above button
    
    // Flip if too close to left edge
    if (left < padding) {
      left = position.x;
    }
    
    // Flip to bottom if too close to top
    if (top < padding) {
      top = position.y + 70;
    }
    
    return {
      position: 'fixed' as const,
      left: `${left}px`,
      top: `${top}px`,
      width: `${sheetWidth}px`,
      height: `${Math.min(sheetHeight, window.innerHeight - 100)}px`,
      zIndex: 50,
    };
  }, [position, open]);

  if (position.x < 0) return null; // Wait for position init

  return (
    <>
      {/* Draggable Floating Button */}
      <div
        ref={dragRef}
        className={`fixed z-40 ${isDragging ? 'cursor-grabbing' : 'cursor-grab'}`}
        style={{
          left: `${position.x}px`,
          top: `${position.y}px`,
          touchAction: 'none', // Prevent scroll on mobile while dragging
        }}
        onMouseDown={handleMouseDown}
      >
        <Button
          ref={buttonRef}
          type="button"
          onClick={handleButtonClick}
          className={`h-14 w-14 rounded-full shadow-xl transition-all duration-200 hover:shadow-2xl hover:scale-105 active:scale-95 ${isDragging ? 'scale-110 ring-2 ring-primary' : ''}`}
        >
          {open ? <X className="h-5 w-5" /> : <Bot className="h-5 w-5" />}
        </Button>
        
        {/* Drag hint tooltip */}
        {!open && !isDragging && (
          <div className="absolute right-full mr-3 top-1/2 -translate-y-1/2 bg-popover text-popover-foreground px-3 py-1.5 rounded-lg text-xs whitespace-nowrap opacity-0 hover:opacity-100 transition-opacity pointer-events-none shadow-lg border">
            <div className="flex items-center gap-1.5">
              <GripVertical className="h-3 w-3" />
              <span>Drag to move • Click to open</span>
            </div>
          </div>
        )}
      </div>

      {/* Custom positioned Sheet (not side drawer) */}
      {open && (
        <div 
          data-sheet-content
          className="fixed bg-background border rounded-xl shadow-2xl flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-200"
          style={getSheetStyle}
        >
          {/* Header - draggable area */}
          <div 
            className="flex items-center justify-between px-4 py-3 border-b bg-muted/30 cursor-grab active:cursor-grabbing"
            onMouseDown={handleMouseDown}
          >
            <div className="flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-primary" />
              <span className="font-semibold text-sm">Fleet Assistant</span>
            </div>
            <Button 
              variant="ghost" 
              size="sm" 
              className="h-8 w-8 p-0"
              onClick={() => setOpen(false)}
            >
              <X className="h-4 w-4" />
            </Button>
          </div>

          {/* Suggestions */}
          <div className="border-b px-4 py-3 bg-muted/10">
            <div className="flex flex-wrap gap-2">
              {suggestions.data?.suggestions.slice(0, 4).map((item) => (
                <Button 
                  key={item.title} 
                  variant="outline" 
                  size="sm" 
                  onClick={() => submit(item.prompt)}
                  className="text-xs"
                >
                  {item.title}
                </Button>
              ))}
            </div>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto px-4 py-4 min-h-0">
            <div className="space-y-3">
              {messages.length === 0 ? (
                <div className="rounded-xl border border-dashed p-4 text-sm text-muted-foreground text-center">
                  Try: "Show overdue work orders", "Find truck by plate", or "Summarize driver issues".
                </div>
              ) : (
                messages.map((message) => (
                  <div
                    key={message.id}
                    className={message.role === "assistant"
                      ? "max-w-[90%] rounded-2xl rounded-tl-md bg-muted px-4 py-3 text-sm"
                      : "ml-auto max-w-[90%] rounded-2xl rounded-tr-md bg-primary px-4 py-3 text-sm text-primary-foreground"
                    }
                  >
                    {message.content}
                  </div>
                ))
              )}
              {chat.isPending && (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Thinking...
                </div>
              )}
            </div>
          </div>

          {/* Input */}
          <div className="border-t p-4 bg-background">
            <div className="flex gap-3">
              <Textarea
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Ask the assistant a fleet question..."
                className="min-h-[80px] resize-none"
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    submit();
                  }
                }}
              />
              <Button 
                type="button" 
                onClick={() => submit()} 
                disabled={disabled} 
                className="self-end h-10 w-10 p-0"
              >
                <Send className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Backdrop */}
      {open && (
        <div 
          className="fixed inset-0 bg-black/20 z-30 animate-in fade-in duration-200"
          onClick={() => setOpen(false)}
        />
      )}
    </>
  );
}