"use client"

import type React from "react"

import { useState, useEffect, useRef } from "react"

interface ChatMessage {
  role: "user" | "assistant"
  text: string
}

interface ChatPanelProps {
  problemId: string
}

export function ChatPanel({ problemId }: ChatPanelProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [input, setInput] = useState("")
  const messagesRef = useRef<HTMLDivElement>(null)

  // Load chat messages for current problem
  useEffect(() => {
    const chatKey = `miniIDE:chat:${problemId}`
    try {
      const saved = localStorage.getItem(chatKey)
      if (saved) {
        setMessages(JSON.parse(saved))
      } else {
        setMessages([])
      }
    } catch {
      setMessages([])
    }
  }, [problemId])

  // Save chat messages
  const saveMessages = (newMessages: ChatMessage[]) => {
    const chatKey = `miniIDE:chat:${problemId}`
    localStorage.setItem(chatKey, JSON.stringify(newMessages))
    setMessages(newMessages)
  }

  // Auto-scroll to bottom
  useEffect(() => {
    if (messagesRef.current) {
      messagesRef.current.scrollTop = messagesRef.current.scrollHeight
    }
  }, [messages])

  const sendMessage = () => {
    const text = input.trim()
    if (!text) return

    const newMessages = [
      ...messages,
      { role: "user" as const, text },
      { role: "assistant" as const, text: `AI (placeholder): I received your message: "${text}"` },
    ]

    saveMessages(newMessages)
    setInput("")
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if ((e.ctrlKey || e.metaKey) && e.key === "Enter") {
      e.preventDefault()
      sendMessage()
    }
  }

  return (
    <aside className="mini-ide-chat-wrap">
      <div className="mini-ide-panel h-full grid grid-rows-[auto_1fr_auto]">
        <div className="mini-ide-row justify-between items-baseline">
          <h3>AI Chat</h3>
          <span className="mini-ide-hint text-xs">Placeholder</span>
        </div>

        <div className="mini-ide-chat-list" ref={messagesRef}>
          {messages.map((message, index) => (
            <div key={index} className={`mini-ide-chat-msg ${message.role}`}>
              <div className="mini-ide-chat-role">{message.role === "user" ? "You" : "AI"}</div>
              <div className="mini-ide-chat-bubble">{message.text}</div>
            </div>
          ))}
        </div>

        <div className="mini-ide-chat-input">
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Ask AI... (placeholder)"
            className="min-h-11 max-h-32"
          />
          <button onClick={sendMessage} className="primary btn">
            Send
          </button>
        </div>
      </div>
    </aside>
  )
}
