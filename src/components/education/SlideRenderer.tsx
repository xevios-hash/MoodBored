import { useState, useRef, useCallback } from 'react'
import type { Slide, BoardItem, WebItem, QuizQuestion, GradeLevel } from '@/types'
import { NarrationEngine } from './NarrationEngine'

interface SlideRendererProps {
  slide: Slide
  gradeLevel: GradeLevel
  onNavigate: (slideId: string) => void
  onComplete: () => void
  onZoomImage: (item: BoardItem) => void
}

export function SlideRenderer({ slide, gradeLevel, onNavigate, onComplete, onZoomImage }: SlideRendererProps) {
  const [revealedItems, setRevealedItems] = useState<Set<string>>(new Set())
  const [quizAnswers, setQuizAnswers] = useState<Record<string, string | number>>({})
  const [showResults, setShowResults] = useState(false)

  // Grade-level styling
  const fontSize = gradeLevel === 'K-2' ? 'text-lg' : gradeLevel === '3-5' ? 'text-base' : 'text-sm'
  const headerSize = gradeLevel === 'K-2' ? 'text-2xl' : gradeLevel === '3-5' ? 'text-xl' : 'text-lg'

  const handleReveal = (itemId: string) => {
    setRevealedItems(prev => new Set([...prev, itemId]))
  }

  const handleQuizAnswer = (questionId: string, answer: string | number) => {
    setQuizAnswers(prev => ({ ...prev, [questionId]: answer }))
  }

  const handleCheckQuiz = () => {
    setShowResults(true)
  }

  const renderContentItem = (item: BoardItem) => {
    if (!('pos' in item)) return null

    switch (item.kind) {
      case 'image':
        return (
          <div 
            key={item.id}
            className="cursor-pointer rounded-lg overflow-hidden hover:opacity-90 transition-opacity"
            onClick={() => onZoomImage(item)}
          >
            <img 
              src={item.thumbnail || item.fullSource} 
              alt={item.description || 'Slide image'}
              className="w-full h-auto max-h-[400px] object-contain"
            />
          </div>
        )
      case 'note':
      case 'text':
        return (
          <div key={item.id} className={`text-gray-800 ${fontSize} leading-relaxed`}>
            {'text' in item ? item.text : 'raw' in item ? item.raw : ''}
          </div>
        )
      case 'web':
        return (
          <div key={item.id} className="rounded-lg overflow-hidden border border-gray-200">
            <iframe 
              src={(item as WebItem).url} 
              className="w-full h-[300px]"
              sandbox="allow-scripts allow-same-origin"
            />
          </div>
        )
      default:
        return null
    }
  }

  const renderQuiz = (questions: QuizQuestion[]) => (
    <div className="space-y-4">
      {questions.map((q, idx) => (
        <div key={q.id} className="bg-white rounded-xl p-4 shadow-sm">
          <div className={`font-semibold mb-3 ${fontSize}`}>
            {idx + 1}. {q.question}
          </div>
          
          {q.type === 'multiple-choice' && q.options && (
            <div className="space-y-2">
              {q.options.map((option, optIdx) => {
                const isSelected = quizAnswers[q.id] === optIdx
                const isCorrect = showResults && optIdx === q.correctAnswer
                const isWrong = showResults && isSelected && optIdx !== q.correctAnswer
                
                return (
                  <button
                    key={optIdx}
                    onClick={() => handleQuizAnswer(q.id, optIdx)}
                    disabled={showResults}
                    className={`w-full text-left px-4 py-2.5 rounded-lg border-2 transition-colors ${
                      isCorrect ? 'border-green-500 bg-green-50' :
                      isWrong ? 'border-red-500 bg-red-50' :
                      isSelected ? 'border-purple-500 bg-purple-50' :
                      'border-gray-200 hover:border-purple-300'
                    }`}
                  >
                    <span className={fontSize}>{option}</span>
                    {isCorrect && <span className="ml-2 text-green-600">✓</span>}
                    {isWrong && <span className="ml-2 text-red-600">✗</span>}
                  </button>
                )
              })}
            </div>
          )}

          {q.type === 'true-false' && (
            <div className="flex gap-2">
              {['True', 'False'].map((option) => {
                const isSelected = quizAnswers[q.id] === option.toLowerCase()
                return (
                  <button
                    key={option}
                    onClick={() => handleQuizAnswer(q.id, option.toLowerCase())}
                    disabled={showResults}
                    className={`flex-1 px-4 py-2.5 rounded-lg border-2 transition-colors ${
                      isSelected ? 'border-purple-500 bg-purple-50' : 'border-gray-200 hover:border-purple-300'
                    }`}
                  >
                    {option}
                  </button>
                )
              })}
            </div>
          )}

          {showResults && q.explanation && (
            <div className="mt-3 p-3 bg-blue-50 rounded-lg text-sm text-blue-800">
              💡 {q.explanation}
            </div>
          )}
        </div>
      ))}
      
      {!showResults && (
        <button
          onClick={handleCheckQuiz}
          className="w-full py-3 bg-purple-600 text-white rounded-xl font-semibold hover:bg-purple-700 transition-colors"
        >
          Check Answers
        </button>
      )}
    </div>
  )

  const renderProject = () => (
    <div className="bg-white rounded-xl p-6 shadow-sm">
      <div className={`font-bold mb-4 ${headerSize}`}>📝 Project</div>
      <div className={`text-gray-700 ${fontSize} leading-relaxed whitespace-pre-wrap`}>
        {slide.project?.instructions}
      </div>
      {slide.project?.resources && slide.project.resources.length > 0 && (
        <div className="mt-4">
          <div className="font-semibold mb-2">Resources:</div>
          <ul className="list-disc list-inside space-y-1">
            {slide.project.resources.map((r, i) => (
              <li key={i} className="text-gray-600">{r}</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )

  const renderBranch = () => (
    <div className="bg-white rounded-xl p-6 shadow-sm text-center">
      <div className={`font-bold mb-6 ${headerSize}`}>{slide.branch?.prompt}</div>
      <div className="flex flex-col gap-3">
        {slide.branch?.choices.map((choice) => (
          <button
            key={choice.targetSlideId}
            onClick={() => onNavigate(choice.targetSlideId)}
            className="px-6 py-4 bg-purple-600 text-white rounded-xl font-semibold hover:bg-purple-700 transition-colors text-lg"
          >
            {choice.label}
          </button>
        ))}
      </div>
    </div>
  )

  return (
    <div className="max-w-4xl mx-auto">
      {/* Title */}
      <h1 className={`font-bold text-gray-900 mb-6 ${headerSize}`}>
        {slide.title}
      </h1>

      {/* Content */}
      <div className="space-y-6">
        {slide.type === 'quiz' && slide.quiz && renderQuiz(slide.quiz)}
        {slide.type === 'project' && renderProject()}
        {slide.type === 'branch' && renderBranch()}
        
        {slide.type !== 'quiz' && slide.type !== 'branch' && (
          <>
            {/* Main content items */}
            {slide.content.map(item => renderContentItem(item))}
            
            {/* Narration */}
            {slide.narration?.script && (
              <div className="mt-6">
                <NarrationEngine 
                  script={slide.narration.script}
                  rate={slide.narration.rate}
                  pitch={slide.narration.pitch}
                  onEnd={onComplete}
                />
              </div>
            )}
          </>
        )}

        {/* Navigation hint */}
        <div className="text-center text-gray-400 text-sm pt-4">
          {slide.type === 'branch' ? 'Choose a path to continue' : 
           slide.type === 'quiz' ? 'Answer the questions above' :
           slide.type === 'project' ? 'Complete the project when ready' :
           'Press → to continue'}
        </div>
      </div>
    </div>
  )
}
