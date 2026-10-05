import { useState, useEffect, useCallback } from 'react'
import type { Lesson, StudentProgress, GradeLevel } from '@/types'
import { calculateRubricScore, generateRubricFeedback, RubricCriteria } from '@/lib/projectTemplates'

interface TeacherViewProps {
  lessons: Lesson[]
  onClose: () => void
}

interface StudentReport {
  studentName: string
  lessonId: string
  lessonTitle: string
  progress: StudentProgress
  score: number
  completion: number
  timeSpent: number
  lastAccessed: string
  strengths: string[]
  improvements: string[]
}

export function TeacherView({ lessons, onClose }: TeacherViewProps) {
  const [reports, setReports] = useState<StudentReport[]>([])
  const [selectedStudent, setSelectedStudent] = useState<string | null>(null)
  const [filterGrade, setFilterGrade] = useState<GradeLevel | 'all'>('all')

  // Load student reports
  useEffect(() => {
    const studentReports: StudentReport[] = []
    
    lessons.forEach(lesson => {
      // Get all students who have progress for this lesson
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i)
        if (key?.startsWith('lesson-progress-')) {
          try {
            const progress: StudentProgress = JSON.parse(localStorage.getItem(key) || '{}')
            if (progress.lessonId === lesson.id) {
              const quizSlides = lesson.slides.filter(s => s.type === 'quiz')
              const totalPoints = quizSlides.reduce((sum, s) => 
                sum + (s.quiz?.reduce((qsum, q) => qsum + q.points, 0) || 0), 0)
              const earnedPoints = Object.values(progress.quizScores || {})
                .reduce((sum, s) => sum + (s > 0 ? 10 : 0), 0)
              const score = totalPoints > 0 ? Math.round((earnedPoints / totalPoints) * 100) : 0
              
              const completion = lesson.slides.length > 0
                ? Math.round((progress.completedSlides.length / lesson.slides.length) * 100)
                : 0

              // Generate strengths and improvements
              const strengths: string[] = []
              const improvements: string[] = []
              
              if (score >= 80) strengths.push('Strong quiz performance')
              if (completion >= 80) strengths.push('High completion rate')
              if (progress.timeSpent > 300) strengths.push('Thorough engagement')
              
              if (score < 60) improvements.push('Review quiz material')
              if (completion < 50) improvements.push('Complete more slides')
              
              studentReports.push({
                studentName: `Student ${studentReports.length + 1}`,
                lessonId: lesson.id,
                lessonTitle: lesson.metadata?.title || 'Untitled',
                progress,
                score,
                completion,
                timeSpent: progress.timeSpent,
                lastAccessed: progress.lastAccessed,
                strengths,
                improvements,
              })
            }
          } catch {}
        }
      }
    })
    
    setReports(studentReports)
  }, [lessons])

  // Filter by grade
  const filteredReports = reports.filter(r => {
    if (filterGrade === 'all') return true
    const lesson = lessons.find(l => l.id === r.lessonId)
    return lesson?.metadata?.gradeLevel === filterGrade
  })

  // Calculate class statistics
  const totalStudents = new Set(filteredReports.map(r => r.studentName)).size
  const averageScore = filteredReports.length > 0
    ? Math.round(filteredReports.reduce((sum, r) => sum + r.score, 0) / filteredReports.length)
    : 0
  const averageCompletion = filteredReports.length > 0
    ? Math.round(filteredReports.reduce((sum, r) => sum + r.completion, 0) / filteredReports.length)
    : 0

  return (
    <div className="fixed inset-0 z-[150] bg-gray-50 overflow-y-auto">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-6 py-6">
        <div className="max-w-7xl mx-auto">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-gray-800">👨‍🏫 Teacher Dashboard</h1>
              <p className="text-gray-500 mt-1">Monitor student progress and provide feedback</p>
            </div>
            <div className="flex items-center gap-3">
              <select
                value={filterGrade}
                onChange={(e) => setFilterGrade(e.target.value as GradeLevel | 'all')}
                className="px-4 py-2 rounded-lg border border-gray-200 bg-white"
              >
                <option value="all">All Grades</option>
                <option value="K-2">K-2</option>
                <option value="3-5">3-5</option>
                <option value="6-8">6-8</option>
                <option value="9-12">9-12</option>
                <option value="adult">Adult</option>
              </select>
              <button
                onClick={onClose}
                className="px-4 py-2 rounded-lg bg-gray-100 text-gray-700 hover:bg-gray-200"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-6 py-8">
        {/* Class Statistics */}
        <div className="grid grid-cols-4 gap-6 mb-8">
          <div className="bg-white rounded-2xl p-6 shadow-sm">
            <div className="text-3xl font-bold text-gray-800">{totalStudents}</div>
            <div className="text-gray-500 mt-1">Active Students</div>
          </div>
          <div className="bg-white rounded-2xl p-6 shadow-sm">
            <div className="text-3xl font-bold text-blue-600">{averageScore}%</div>
            <div className="text-gray-500 mt-1">Average Score</div>
          </div>
          <div className="bg-white rounded-2xl p-6 shadow-sm">
            <div className="text-3xl font-bold text-green-600">{averageCompletion}%</div>
            <div className="text-gray-500 mt-1">Average Completion</div>
          </div>
          <div className="bg-white rounded-2xl p-6 shadow-sm">
            <div className="text-3xl font-bold text-purple-600">{lessons.length}</div>
            <div className="text-gray-500 mt-1">Lessons</div>
          </div>
        </div>

        {/* Student Reports */}
        <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-200">
            <h2 className="text-lg font-semibold text-gray-800">Student Reports</h2>
          </div>
          
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Student
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Lesson
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Progress
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Score
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Time
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Last Active
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {filteredReports.map((report, idx) => (
                  <tr key={idx} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        <div className="w-8 h-8 rounded-full bg-purple-100 flex items-center justify-center">
                          <span className="text-sm">👤</span>
                        </div>
                        <div className="ml-3">
                          <div className="text-sm font-medium text-gray-900">{report.studentName}</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-900">{report.lessonTitle}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        <div className="w-24 h-2 bg-gray-200 rounded-full overflow-hidden mr-2">
                          <div 
                            className="h-full bg-gradient-to-r from-purple-500 to-indigo-500"
                            style={{ width: `${report.completion}%` }}
                          />
                        </div>
                        <span className="text-sm text-gray-600">{report.completion}%</span>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className={`text-sm font-medium ${
                        report.score >= 90 ? 'text-green-600' :
                        report.score >= 80 ? 'text-blue-600' :
                        report.score >= 70 ? 'text-yellow-600' :
                        'text-red-600'
                      }`}>
                        {report.score}%
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-600">
                        {Math.floor(report.timeSpent / 60)}m
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-500">
                        {new Date(report.lastAccessed).toLocaleDateString()}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <button
                        onClick={() => setSelectedStudent(report.studentName)}
                        className="text-purple-600 hover:text-purple-700 text-sm font-medium"
                      >
                        View Details
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {filteredReports.length === 0 && (
            <div className="text-center py-12">
              <div className="text-6xl mb-4">👥</div>
              <h3 className="text-xl font-semibold text-gray-800 mb-2">No student data yet</h3>
              <p className="text-gray-500">Student progress will appear here once they start lessons</p>
            </div>
          )}
        </div>

        {/* Student Detail Modal */}
        {selectedStudent && (() => {
          const report = filteredReports.find(r => r.studentName === selectedStudent)
          if (!report) return null

          return (
            <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-[160]">
              <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl max-h-[80vh] overflow-hidden">
                <div className="px-6 py-4 border-b border-gray-200 flex justify-between items-center">
                  <h2 className="text-xl font-bold text-gray-800">{report.studentName}</h2>
                  <button
                    onClick={() => setSelectedStudent(null)}
                    className="p-2 rounded-lg hover:bg-gray-100"
                  >
                    ✕
                  </button>
                </div>

                <div className="p-6 overflow-y-auto max-h-[60vh]">
                  {/* Stats */}
                  <div className="grid grid-cols-3 gap-4 mb-6">
                    <div className="text-center p-4 bg-gray-50 rounded-xl">
                      <div className="text-2xl font-bold text-gray-800">{report.completion}%</div>
                      <div className="text-sm text-gray-500">Complete</div>
                    </div>
                    <div className="text-center p-4 bg-gray-50 rounded-xl">
                      <div className={`text-2xl font-bold ${
                        report.score >= 90 ? 'text-green-600' :
                        report.score >= 80 ? 'text-blue-600' :
                        report.score >= 70 ? 'text-yellow-600' :
                        'text-red-600'
                      }`}>
                        {report.score}%
                      </div>
                      <div className="text-sm text-gray-500">Score</div>
                    </div>
                    <div className="text-center p-4 bg-gray-50 rounded-xl">
                      <div className="text-2xl font-bold text-gray-800">
                        {Math.floor(report.timeSpent / 60)}m
                      </div>
                      <div className="text-sm text-gray-500">Time Spent</div>
                    </div>
                  </div>

                  {/* Strengths */}
                  {report.strengths.length > 0 && (
                    <div className="mb-6">
                      <h3 className="font-semibold text-gray-800 mb-2">✅ Strengths</h3>
                      <div className="space-y-1">
                        {report.strengths.map((s, idx) => (
                          <div key={idx} className="text-sm text-gray-600">{s}</div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Improvements */}
                  {report.improvements.length > 0 && (
                    <div className="mb-6">
                      <h3 className="font-semibold text-gray-800 mb-2">💡 Areas for Improvement</h3>
                      <div className="space-y-1">
                        {report.improvements.map((i, idx) => (
                          <div key={idx} className="text-sm text-gray-600">{i}</div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Recommendations */}
                  <div className="p-4 bg-blue-50 rounded-xl">
                    <h3 className="font-semibold text-blue-800 mb-2">Recommendations</h3>
                    <div className="text-sm text-blue-700">
                      {report.score >= 80 && report.completion >= 80
                        ? 'Great progress! Consider assigning more challenging material.'
                        : report.completion < 50
                          ? 'Encourage the student to complete more lessons.'
                          : 'Review quiz material together to improve understanding.'}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )
        })()}
      </div>
    </div>
  )
}
