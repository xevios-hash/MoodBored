import { useState, useCallback } from 'react'
import type { Slide, BoardItem, WebItem, QuizQuestion, GradeLevel, SlideInteraction } from '@/types'
import { NarrationEngine } from './NarrationEngine'
import { getEducationTheme, a11y, ariaLabels } from './GradeSchoolTheme'
import { ProjectSubmission, ProjectSubmissionData } from './ProjectSubmission'

interface SlideRendererProps {
  slide: Slide
  gradeLevel: GradeLevel
  onNavigate: (slideId: string) => void
  onComplete: () => void
  onZoomImage: (item: BoardItem) => void
  onScoreUpdate?: (questionId: string, score: number) => void
}

export function SlideRenderer({ slide, gradeLevel, onNavigate, onComplete, onZoomImage, onScoreUpdate }: SlideRendererProps) {
  const [revealedItems, setRevealedItems] = useState<Set<string>>(new Set())
  const [quizAnswers, setQuizAnswers] = useState<Record<string, string | number>>({})
  const [showResults, setShowResults] = useState(false)
  const [projectSubmitted, setProjectSubmitted] = useState(false)
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0)
  const [showProjectSubmission, setShowProjectSubmission] = useState(false)
  
  const theme = getEducationTheme(gradeLevel)

  // Grade-level styling
  const fontSize = theme.fontSize.body
  const headerSize = theme.fontSize.header
  const buttonSize = theme.spacing.buttonPadding + ' font-semibold'

  const handleReveal = useCallback((itemId: string) => {
    setRevealedItems(prev => new Set([...prev, itemId]))
  }, [])

  const handleQuizAnswer = useCallback((questionId: string, answer: string | number) => {
    setQuizAnswers(prev => ({ ...prev, [questionId]: answer }))
  }, [])

  const handleCheckQuiz = useCallback(() => {
    setShowResults(true)
    // Calculate and report scores
    if (slide.quiz && onScoreUpdate) {
      slide.quiz.forEach(q => {
        const userAnswer = quizAnswers[q.id]
        const isCorrect = userAnswer === q.correctAnswer
        onScoreUpdate(q.id, isCorrect ? q.points : 0)
      })
    }
  }, [slide.quiz, quizAnswers, onScoreUpdate])

  const handleProjectSubmit = useCallback(() => {
    setShowProjectSubmission(true)
  }, [])

  const handleProjectSubmitted = useCallback((submission: ProjectSubmissionData) => {
    setProjectSubmitted(true)
    setShowProjectSubmission(false)
    onComplete()
  }, [onComplete])

  const handleBranchChoice = useCallback((targetSlideId: string) => {
    onNavigate(targetSlideId)
  }, [onNavigate])

  const renderContentItem = (item: BoardItem) => {
    if (!('pos' in item)) return null

    switch (item.kind) {
      case 'image':
        return (
          <div 
            key={item.id}
            className="cursor-pointer rounded-xl overflow-hidden hover:opacity-90 transition-opacity shadow-sm"
            onClick={() => onZoomImage(item)}
          >
            <img 
              src={(item as any).thumbnail || (item as any).fullSource} 
              alt={(item as any).description || 'Slide image'}
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
          <div key={item.id} className="rounded-xl overflow-hidden border border-gray-200 shadow-sm">
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

  // Click-to-reveal annotation
  const renderReveal = (interaction: SlideInteraction) => (
    <button
      key={interaction.target}
      onClick={() => handleReveal(interaction.target)}
      className={`w-full ${buttonSize} rounded-xl border-2 border-dashed border-purple-300 bg-purple-50 text-purple-700 font-medium hover:bg-purple-100 transition-colors`}
    >
      {revealedItems.has(interaction.target) ? (
        <span>✓ Revealed!</span>
      ) : (
        <span>👆 Click to reveal</span>
      )}
    </button>
  )

  const renderQuiz = (questions: QuizQuestion[]) => {
    const currentQ = questions[currentQuestionIndex]
    if (!currentQ) return null

    return (
      <div className="space-y-4" role="region" aria-label={ariaLabels.quizQuestion(currentQuestionIndex, questions.length)}>
        {/* Question counter */}
        <div className="flex justify-between items-center">
          <div className={`text-sm text-gray-500 ${theme.fontSize.caption}`}>
            {ariaLabels.quizQuestion(currentQuestionIndex, questions.length)}
          </div>
          <div className={`text-sm text-gray-500 ${theme.fontSize.caption}`}>
            {Object.keys(quizAnswers).length} answered
          </div>
        </div>

        {/* Current question */}
        <div className="bg-white rounded-2xl p-6 shadow-sm" role="group" aria-label="Quiz question">
          <div className={`font-semibold mb-4 ${fontSize}`}>
            {currentQ.question}
          </div>
          
          {currentQ.type === 'multiple-choice' && currentQ.options && (
            <div className="space-y-3">
              {currentQ.options.map((option, optIdx) => {
                const isSelected = quizAnswers[currentQ.id] === optIdx
                const isCorrect = showResults && optIdx === currentQ.correctAnswer
                const isWrong = showResults && isSelected && optIdx !== currentQ.correctAnswer
                
                return (
                  <button
                    key={optIdx}
                    onClick={() => handleQuizAnswer(currentQ.id, optIdx)}
                    disabled={showResults}
                    aria-label={`${String.fromCharCode(65 + optIdx)}: ${option}`}
                    aria-pressed={isSelected}
                    className={`w-full text-left px-5 py-4 rounded-xl border-2 transition-all ${
                      isCorrect ? 'border-green-500 bg-green-50 shadow-sm' :
                      isWrong ? 'border-red-500 bg-red-50 shadow-sm' :
                      isSelected ? 'border-purple-500 bg-purple-50 shadow-sm' :
                      'border-gray-200 hover:border-purple-300 hover:bg-purple-50/50'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <div className={`w-8 h-8 rounded-full border-2 flex items-center justify-center text-sm font-medium ${
                        isCorrect ? 'border-green-500 bg-green-500 text-white' :
                        isWrong ? 'border-red-500 bg-red-500 text-white' :
                        isSelected ? 'border-purple-500 bg-purple-500 text-white' :
                        'border-gray-300'
                      }`}>
                        {isCorrect ? '✓' : isWrong ? '✗' : String.fromCharCode(65 + optIdx)}
                      </div>
                      <span className={fontSize}>{option}</span>
                    </div>
                  </button>
                )
              })}
            </div>
          )}

          {currentQ.type === 'true-false' && (
            <div className="flex gap-3">
              {['True', 'False'].map((option) => {
                const isSelected = quizAnswers[currentQ.id] === option.toLowerCase()
                const correctAnswer = currentQ.correctAnswer === option.toLowerCase() || 
                  currentQ.correctAnswer === (option === 'True' ? 'true' : 'false')
                const isCorrect = showResults && correctAnswer
                const isWrong = showResults && isSelected && !correctAnswer
                
                return (
                  <button
                    key={option}
                    onClick={() => handleQuizAnswer(currentQ.id, option.toLowerCase())}
                    disabled={showResults}
                    className={`flex-1 ${buttonSize} rounded-xl border-2 transition-all ${
                      isCorrect ? 'border-green-500 bg-green-50' :
                      isWrong ? 'border-red-500 bg-red-50' :
                      isSelected ? 'border-purple-500 bg-purple-50' :
                      'border-gray-200 hover:border-purple-300'
                    }`}
                  >
                    {option === 'True' ? '✓ True' : '✗ False'}
                  </button>
                )
              })}
            </div>
          )}

          {currentQ.type === 'fill-blank' && (
            <input
              type="text"
              value={quizAnswers[currentQ.id] as string || ''}
              onChange={(e) => handleQuizAnswer(currentQ.id, e.target.value)}
              disabled={showResults}
              placeholder="Type your answer..."
              className={`w-full ${buttonSize} rounded-xl border-2 border-gray-200 focus:border-purple-500 focus:outline-none`}
            />
          )}

          {/* Feedback */}
          {showResults && currentQ.explanation && (
            <div className={`mt-4 p-4 rounded-xl ${
              quizAnswers[currentQ.id] === currentQ.correctAnswer 
                ? 'bg-green-50 border border-green-200' 
                : 'bg-blue-50 border border-blue-200'
            }`}>
              <div className="flex items-start gap-2">
                <span className="text-xl">
                  {quizAnswers[currentQ.id] === currentQ.correctAnswer ? '🎉' : '💡'}
                </span>
                <div className={fontSize}>
                  {quizAnswers[currentQ.id] === currentQ.correctAnswer 
                    ? 'Correct! ' 
                    : 'Not quite. '}
                  {currentQ.explanation}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Navigation */}
        <div className="flex gap-3">
          {currentQuestionIndex > 0 && (
            <button
              onClick={() => setCurrentQuestionIndex(prev => prev - 1)}
              className={`flex-1 ${buttonSize} rounded-xl font-semibold bg-gray-100 text-gray-700 hover:bg-gray-200 transition-colors`}
            >
              ← Previous
            </button>
          )}
          
          {!showResults && (
            <button
              onClick={handleCheckQuiz}
              className={`flex-1 ${buttonSize} rounded-xl font-semibold bg-purple-600 text-white hover:bg-purple-700 transition-colors`}
            >
              Check Answer
            </button>
          )}
          
          {showResults && currentQuestionIndex < questions.length - 1 && (
            <button
              onClick={() => { setShowResults(false); setCurrentQuestionIndex(prev => prev + 1) }}
              className={`flex-1 ${buttonSize} rounded-xl font-semibold bg-purple-600 text-white hover:bg-purple-700 transition-colors`}
            >
              Next Question →
            </button>
          )}
          
          {showResults && currentQuestionIndex === questions.length - 1 && (
            <button
              onClick={onComplete}
              className={`flex-1 ${buttonSize} rounded-xl font-semibold bg-green-600 text-white hover:bg-green-700 transition-colors`}
            >
              Continue →
            </button>
          )}
        </div>
      </div>
    )
  }

  const renderProject = () => (
    <div className="bg-white rounded-2xl p-6 shadow-sm">
      <div className="flex items-center gap-3 mb-4">
        <div className="w-12 h-12 rounded-xl bg-orange-100 flex items-center justify-center">
          <span className="text-2xl">📝</span>
        </div>
        <div>
          <div className={`font-bold ${headerSize}`}>Project</div>
          <div className="text-sm text-gray-500">Hands-on activity</div>
        </div>
      </div>
      
      <div className={`text-gray-700 ${fontSize} leading-relaxed whitespace-pre-wrap mb-6`}>
        {slide.project?.instructions}
      </div>
      
      {slide.project?.resources && slide.project.resources.length > 0 && (
        <div className="mb-6">
          <div className="font-semibold mb-3 text-gray-800">📚 Resources</div>
          <div className="space-y-2">
            {slide.project.resources.map((r, i) => (
              <div key={i} className="flex items-center gap-2 text-gray-600">
                <span className="w-6 h-6 rounded-full bg-gray-100 flex items-center justify-center text-xs">{i + 1}</span>
                {r}
              </div>
            ))}
          </div>
        </div>
      )}

      <button
        onClick={handleProjectSubmit}
        disabled={projectSubmitted}
        className={`w-full ${buttonSize} rounded-xl font-semibold transition-colors ${
          projectSubmitted 
            ? 'bg-green-100 text-green-700 cursor-default' 
            : 'bg-orange-500 text-white hover:bg-orange-600'
        }`}
      >
        {projectSubmitted ? '✓ Submitted!' : 'Submit Project'}
      </button>
    </div>
  )

  const renderBranch = () => (
    <div className="bg-white rounded-2xl p-6 shadow-sm text-center">
      <div className="w-16 h-16 rounded-full bg-purple-100 flex items-center justify-center mx-auto mb-4">
        <span className="text-3xl">🔀</span>
      </div>
      <div className={`font-bold mb-2 ${headerSize}`}>{slide.branch?.prompt}</div>
      <div className="text-gray-500 mb-6">Choose your path to continue</div>
      
      <div className="space-y-3">
        {slide.branch?.choices.map((choice, idx) => (
          <button
            key={choice.targetSlideId}
            onClick={() => handleBranchChoice(choice.targetSlideId)}
            className={`w-full ${buttonSize} rounded-xl font-semibold bg-gradient-to-r from-purple-600 to-blue-600 text-white hover:from-purple-700 hover:to-blue-700 transition-all shadow-md hover:shadow-lg`}
          >
            <span className="flex items-center justify-center gap-2">
              <span className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center">
                {String.fromCharCode(65 + idx)}
              </span>
              {choice.label}
            </span>
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

      {/* Content based on slide type */}
      <div className="space-y-6">
        {slide.type === 'quiz' && slide.quiz && renderQuiz(slide.quiz)}
        {slide.type === 'project' && renderProject()}
        {slide.type === 'branch' && renderBranch()}
        
        {/* Reveal interactions */}
        {slide.interactions?.filter(i => i.type === 'reveal').map(renderReveal)}
        
        {slide.type !== 'quiz' && slide.type !== 'branch' && slide.type !== 'project' && (
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
           slide.type === 'quiz' ? 'Answer the question above' :
           slide.type === 'project' ? 'Complete the project when ready' :
           'Press → to continue'}
        </div>
      </div>

      {/* Project Submission Modal */}
      {showProjectSubmission && (
        <ProjectSubmission
          slide={slide}
          gradeLevel={gradeLevel}
          onSubmit={handleProjectSubmitted}
          onClose={() => setShowProjectSubmission(false)}
        />
      )}
    </div>
  )
}
