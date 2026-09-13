export function calculateSkillMatch(
  studentSkills: string[],
  requiredSkills: string[]
) {
  const student = new Set(
    studentSkills.map((skill) => skill.toLowerCase().trim())
  )

  const required = requiredSkills.map((skill) =>
    skill.toLowerCase().trim()
  )

  const matchedSkills = required.filter((skill) => student.has(skill))

  const missingSkills = required.filter((skill) => !student.has(skill))

  const matchScore =
    required.length === 0
      ? 0
      : Math.round((matchedSkills.length / required.length) * 100)

  return {
    matchScore,
    matchedSkills,
    missingSkills,
  }
}