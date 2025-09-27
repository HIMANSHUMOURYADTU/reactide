"use client"

import { useState, useEffect, useRef } from "react"
import { MonacoEditor } from "./monaco-editor"
import { ProblemPanel } from "./problem-panel"
import { ChatPanel } from "./chat-panel"
import { Toolbar } from "./toolbar"
import { ResizableLayout } from "./resizable-layout"
import { getProblemTemplate } from "@/lib/problems"
import { useAutosave } from "@/hooks/use-autosave"
import { fileSystemManager } from "@/lib/file-system"
import { BackendSync } from "@/lib/backend-sync"

export function MiniIDE() {
  const [language, setLanguage] = useState("javascript")
  const [theme, setTheme] = useState("vs-dark")
  const [code, setCode] = useState("")
  const [stdin, setStdin] = useState("")
  const [status, setStatus] = useState("Idle")
  const [problemId, setProblemId] = useState("two-sum")
  const [isMaximized, setIsMaximized] = useState(false)
  const [syncBackend, setSyncBackend] = useState(false)
  const [backendUrl, setBackendUrl] = useState("http://localhost:3001")
  const [consoleOutput, setConsoleOutput] = useState("Ready.")

  const sessionId = useRef(crypto.randomUUID?.() || `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`)

  const { saveSnapshot } = useAutosave({
    code,
    language,
    problemId,
    sessionId: sessionId.current,
    syncBackend,
    backendUrl,
    onStatusChange: setStatus,
  })

  useEffect(() => {
    // Load saved settings
    const savedTheme = localStorage.getItem("miniIDE:theme") || "vs-dark"
    const savedProblemId = localStorage.getItem("miniIDE:problemId") || "two-sum"
    const savedSyncBackend = localStorage.getItem("miniIDE:syncBackend") === "true"
    const savedBackendUrl = localStorage.getItem("miniIDE:backendUrl") || "http://localhost:3001"

    setTheme(savedTheme)
    setProblemId(savedProblemId)
    setSyncBackend(savedSyncBackend)
    setBackendUrl(savedBackendUrl)
  }, [])

  useEffect(() => {
    // Save settings
    localStorage.setItem("miniIDE:theme", theme)
    localStorage.setItem("miniIDE:problemId", problemId)
    localStorage.setItem("miniIDE:syncBackend", String(syncBackend))
    localStorage.setItem("miniIDE:backendUrl", backendUrl)
  }, [theme, problemId, syncBackend, backendUrl])

  // Load stdin for current problem
  useEffect(() => {
    const savedStdin = localStorage.getItem(`miniIDE:stdin:${problemId}`) || ""
    setStdin(savedStdin)
  }, [problemId])

  // Save stdin for current problem
  useEffect(() => {
    localStorage.setItem(`miniIDE:stdin:${problemId}`, stdin)
  }, [stdin, problemId])

  const handleRun = async () => {
    const runData = {
      type: "run",
      sessionId: sessionId.current,
      lang: language,
      timestamp: new Date().toISOString(),
      problemId,
      stdin: stdin || "",
      code,
    }

    const json = JSON.stringify(runData, null, 2)
    localStorage.setItem("miniIDE:run", json)

    const fileWritten = await fileSystemManager.writeFile("run.json", json + "\n")
    setStatus(fileWritten ? "Run saved to folder" : "Run prepared")
    setConsoleOutput("[client] Run prepared...")

    // Optional backend sync
    if (syncBackend && backendUrl) {
      try {
        const backendSync = new BackendSync(backendUrl)
        const result = await backendSync.postRun({
          sessionId: runData.sessionId,
          problemId: runData.problemId,
          language: runData.lang,
          code: runData.code,
          input: runData.stdin,
          timestamp: runData.timestamp,
        })

        if (result.ok) {
          setStatus("Run posted to backend")
          const output = []
          if (result.note) output.push("note: " + result.note)
          if (typeof result.exitCode !== "undefined") output.push("exitCode: " + result.exitCode)
          if (result.runOut) output.push("\n" + result.runOut)
          if (result.runErr) output.push("\n[stderr]\n" + result.runErr)
          setConsoleOutput(output.join("\n"))
        } else {
          setConsoleOutput("Backend responded without ok flag.")
        }
      } catch (error) {
        console.warn("Backend run failed", error)
        setStatus("Backend run failed")
        setConsoleOutput("Backend run failed: " + (error as Error).message)
      }
    }
  }

  const handleClear = () => {
    if (!confirm("Clear local saved code, snapshot and run?")) return

    // Clear stored data
    const problems = ["two-sum", "reverse-string", "fibonacci"]
    const languages = ["javascript", "python", "java", "cpp", "go"]

    for (const p of problems) {
      for (const l of languages) {
        localStorage.removeItem(`miniIDE:code:${p}:${l}`)
        localStorage.removeItem(`miniIDE:stdin:${p}`)
      }
    }

    localStorage.removeItem("miniIDE:snapshot")
    localStorage.removeItem("miniIDE:run")
    setStdin("")
    setStatus("Cleared")
    setConsoleOutput("Cleared local data.")
  }

  const handleReset = () => {
    const template = getProblemTemplate(problemId, language)
    setCode(template)
    setStatus("Reset to template")
  }

  useEffect(() => {
    const handleKeyDown = async (e: KeyboardEvent) => {
      // Ctrl+Enter or Cmd+Enter to run
      if ((e.ctrlKey || e.metaKey) && e.key === "Enter") {
        e.preventDefault()
        await handleRun()
      }
      // Ctrl+S or Cmd+S to save snapshot
      if ((e.ctrlKey || e.metaKey) && (e.key === "s" || e.key === "S")) {
        e.preventDefault()
        await saveSnapshot()
      }
      // Escape to toggle maximize editor
      if (e.key === "Escape") {
        setIsMaximized((prev) => !prev)
      }
    }

    window.addEventListener("keydown", handleKeyDown)
    return () => window.removeEventListener("keydown", handleKeyDown)
  }, [saveSnapshot])

  const handleProblemChange = (newProblemId: string) => {
    setProblemId(newProblemId)
    // Load saved code for new problem or use template
    const saveKey = `miniIDE:code:${newProblemId}:${language}`
    const savedCode = localStorage.getItem(saveKey)
    const codeToLoad = savedCode || getProblemTemplate(newProblemId, language)
    setCode(codeToLoad)
  }

  const handleLanguageChange = (newLanguage: string) => {
    setLanguage(newLanguage)
    // Load saved code for current problem in new language or use template
    const saveKey = `miniIDE:code:${problemId}:${newLanguage}`
    const savedCode = localStorage.getItem(saveKey)
    const codeToLoad = savedCode || getProblemTemplate(problemId, newLanguage)
    setCode(codeToLoad)
  }

  return (
    <div className={`mini-ide ${isMaximized ? "max-editor" : ""}`}>
      <header className="mini-ide-header">
        <h1>Mini IDE</h1>
        <Toolbar
          language={language}
          setLanguage={handleLanguageChange}
          theme={theme}
          setTheme={setTheme}
          problemId={problemId}
          setProblemId={handleProblemChange}
          syncBackend={syncBackend}
          setSyncBackend={setSyncBackend}
          backendUrl={backendUrl}
          setBackendUrl={setBackendUrl}
          isMaximized={isMaximized}
          setIsMaximized={setIsMaximized}
          status={status}
          onRun={handleRun}
          onClear={handleClear}
          onReset={handleReset}
          onStatusChange={setStatus}
        />
      </header>

      <ResizableLayout isMaximized={isMaximized}>
        <ProblemPanel problemId={problemId} />

        <div className="mini-ide-gutter" />

        <section className="grid grid-rows-[1fr_auto] min-h-0 h-full editor-wrap">
          <div className="mini-ide-panel h-full flex flex-col">
            <div className="mini-ide-row justify-between items-baseline mb-1.5">
              <h3>Editor</h3>
              <span className="mini-ide-hint">Autosaves snapshot to output folder every 3s</span>
            </div>
            <MonacoEditor language={language} theme={theme} value={code} onChange={setCode} problemId={problemId} />
            <div className="mt-2">
              <div className="mini-ide-row">
                <span className="mini-ide-kbd">stdin</span>
                <span className="mini-ide-hint">Optional input for run request</span>
              </div>
              <div className="mini-ide-row flex-1 mt-1">
                <textarea
                  value={stdin}
                  onChange={(e) => setStdin(e.target.value)}
                  placeholder="Sample input lines..."
                  className="mini-ide-textarea"
                />
              </div>
            </div>
          </div>

          <div className="mini-ide-panel mt-2">
            <div className="mini-ide-row justify-between items-center">
              <h3>Console</h3>
              <span className="text-xs text-muted-foreground">
                Ctrl+Enter to Run • Ctrl+S to Snapshot • Esc to Maximize
              </span>
            </div>
            <pre className="mini-ide-console min-h-[120px]">{consoleOutput}</pre>
          </div>
        </section>

        <div className="mini-ide-gutter" />

        <ChatPanel problemId={problemId} />
      </ResizableLayout>
    </div>
  )
}
