'use client'

import { useState, useCallback } from 'react'
import {
  Smile, Frown, Angry, Meh, Heart, Zap,
  MessageSquare, Move, RotateCcw, ChevronDown, ChevronUp,
  Sparkles, X
} from 'lucide-react'

// Emotion presets
const EMOTIONS = [
  { id: 'neutral', label: 'Neutral', icon: Meh, color: 'text-slate-400' },
  { id: 'happy', label: 'Happy', icon: Smile, color: 'text-yellow-400' },
  { id: 'sad', label: 'Sad', icon: Frown, color: 'text-blue-400' },
  { id: 'angry', label: 'Angry', icon: Angry, color: 'text-red-400' },
  { id: 'love', label: 'Love', icon: Heart, color: 'text-pink-400' },
  { id: 'surprised', label: 'Surprised', icon: Zap, color: 'text-amber-400' },
]

// Pose categories - only poses with actual FBX files in /public/animations/
const POSE_CATEGORIES = [
  {
    name: 'Idle',
    poses: [
      { id: 'idle-neutral', label: 'Standing', path: null },
    ]
  },
  {
    name: 'Actions',
    poses: [
      { id: 'body-block', label: 'Body Block', path: '/animations/Body Block.fbx' },
    ]
  },
  {
    name: 'Dance',
    poses: [
      { id: 'hip-hop', label: 'Hip Hop', path: '/animations/Hip Hop Dancing (1).fbx' },
    ]
  },
]

interface CharacterActionPanelProps {
  characterName: string
  characterId: string
  currentPose: string | null
  currentEmotion: string | null
  onChangePose: (poseId: string, posePath: string | null) => void
  onChangeEmotion: (emotionId: string) => void
  onAddDialogue: (text: string) => void
  onClose: () => void
}

export default function CharacterActionPanel({
  characterName,
  characterId,
  currentPose,
  currentEmotion,
  onChangePose,
  onChangeEmotion,
  onAddDialogue,
  onClose
}: CharacterActionPanelProps) {
  const [activeTab, setActiveTab] = useState<'pose' | 'emotion' | 'dialogue'>('pose')
  const [expandedCategory, setExpandedCategory] = useState<string>('Idle')
  const [dialogueText, setDialogueText] = useState('')

  const handleAddDialogue = useCallback(() => {
    if (dialogueText.trim()) {
      onAddDialogue(dialogueText.trim())
      setDialogueText('')
    }
  }, [dialogueText, onAddDialogue])

  return (
    <div className="absolute bottom-4 left-4 right-4 md:left-auto md:right-4 md:w-80 bg-slate-900/95 backdrop-blur-sm rounded-xl border border-slate-700 shadow-2xl overflow-hidden z-20">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-2 bg-slate-800/80 border-b border-slate-700">
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-emerald-400" />
          <span className="text-sm font-medium text-slate-200">{characterName}</span>
        </div>
        <button
          onClick={onClose}
          className="p-1 rounded hover:bg-slate-700 text-slate-400 hover:text-slate-200"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Tab buttons */}
      <div className="flex border-b border-slate-700">
        <button
          onClick={() => setActiveTab('pose')}
          className={`flex-1 py-2 text-xs font-medium transition-colors ${
            activeTab === 'pose'
              ? 'text-sky-400 bg-sky-500/10 border-b-2 border-sky-400'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <Move className="w-3.5 h-3.5 mx-auto mb-0.5" />
          Pose
        </button>
        <button
          onClick={() => setActiveTab('emotion')}
          className={`flex-1 py-2 text-xs font-medium transition-colors ${
            activeTab === 'emotion'
              ? 'text-sky-400 bg-sky-500/10 border-b-2 border-sky-400'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <Smile className="w-3.5 h-3.5 mx-auto mb-0.5" />
          Expression
        </button>
        <button
          onClick={() => setActiveTab('dialogue')}
          className={`flex-1 py-2 text-xs font-medium transition-colors ${
            activeTab === 'dialogue'
              ? 'text-sky-400 bg-sky-500/10 border-b-2 border-sky-400'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <MessageSquare className="w-3.5 h-3.5 mx-auto mb-0.5" />
          Dialogue
        </button>
      </div>

      {/* Tab content */}
      <div className="p-3 max-h-64 overflow-y-auto">
        {/* Pose tab */}
        {activeTab === 'pose' && (
          <div className="space-y-2">
            {POSE_CATEGORIES.map(category => (
              <div key={category.name} className="rounded-lg bg-slate-800/50 overflow-hidden">
                <button
                  onClick={() => setExpandedCategory(expandedCategory === category.name ? '' : category.name)}
                  className="w-full flex items-center justify-between px-3 py-2 text-xs font-medium text-slate-300 hover:bg-slate-700/50"
                >
                  {category.name}
                  {expandedCategory === category.name ? (
                    <ChevronUp className="w-3.5 h-3.5" />
                  ) : (
                    <ChevronDown className="w-3.5 h-3.5" />
                  )}
                </button>
                {expandedCategory === category.name && (
                  <div className="grid grid-cols-2 gap-1 p-2 pt-0">
                    {category.poses.map(pose => (
                      <button
                        key={pose.id}
                        onClick={() => onChangePose(pose.id, pose.path)}
                        className={`px-2 py-1.5 rounded text-xs transition-colors ${
                          currentPose === pose.id
                            ? 'bg-sky-500 text-white'
                            : 'bg-slate-700/50 text-slate-300 hover:bg-slate-600/50'
                        }`}
                      >
                        {pose.label}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {/* Emotion tab */}
        {activeTab === 'emotion' && (
          <div className="grid grid-cols-3 gap-2">
            {EMOTIONS.map(emotion => {
              const Icon = emotion.icon
              return (
                <button
                  key={emotion.id}
                  onClick={() => onChangeEmotion(emotion.id)}
                  className={`flex flex-col items-center gap-1 p-3 rounded-lg transition-colors ${
                    currentEmotion === emotion.id
                      ? 'bg-sky-500/20 ring-1 ring-sky-400'
                      : 'bg-slate-800/50 hover:bg-slate-700/50'
                  }`}
                >
                  <Icon className={`w-6 h-6 ${emotion.color}`} />
                  <span className="text-[10px] text-slate-300">{emotion.label}</span>
                </button>
              )
            })}
          </div>
        )}

        {/* Dialogue tab */}
        {activeTab === 'dialogue' && (
          <div className="space-y-3">
            <textarea
              value={dialogueText}
              onChange={(e) => setDialogueText(e.target.value)}
              placeholder={`What does ${characterName} say?`}
              className="w-full px-3 py-2 bg-slate-800 border border-slate-600 rounded-lg text-sm text-slate-200 placeholder:text-slate-500 resize-none focus:outline-none focus:ring-1 focus:ring-sky-500"
              rows={3}
            />
            <button
              onClick={handleAddDialogue}
              disabled={!dialogueText.trim()}
              className="w-full py-2 bg-gradient-to-r from-sky-500 to-blue-600 text-white text-sm font-medium rounded-lg hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed transition-opacity"
            >
              Add Dialogue at Current Time
            </button>
            <p className="text-[10px] text-slate-500 text-center">
              Dialogue will appear as subtitles during playback
            </p>
          </div>
        )}
      </div>

      {/* Quick tip */}
      <div className="px-3 py-2 bg-slate-800/50 border-t border-slate-700">
        <p className="text-[10px] text-slate-500 flex items-center gap-1">
          <Sparkles className="w-3 h-3" />
          Changes create keyframes automatically at current time
        </p>
      </div>
    </div>
  )
}
