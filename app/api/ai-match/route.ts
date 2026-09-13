import { NextResponse } from "next/server"

export async function POST(req: Request) {
  try {
    const { studentSkills, projectSkills } = await req.json()

    const response = await fetch(
      "https://api.groq.com/openai/v1/chat/completions",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${process.env.GROQ_API_KEY}`,
        },
        body: JSON.stringify({
          model: "openai/gpt-oss-20b",
          messages: [
            {
              role: "system",
              content:
                "You are an AI project matching assistant. Give a short, friendly explanation of how a student's skills match a project's required skills.",
            },
            {
              role: "user",
              content: `Student skills: ${studentSkills.join(", ") || "None"}

Project required skills: ${projectSkills.join(", ") || "None"}

Explain the match in 2 short sentences.`,
            },
          ],
          temperature: 0.3,
          max_tokens: 150,
        }),
      }
    )

    const data = await response.json()

    if (!response.ok) {
      console.error("GROQ ERROR:", data)

      return NextResponse.json(
        {
          error:
            data?.error?.message || "Groq request failed",
        },
        { status: response.status }
      )
    }

    return NextResponse.json({
      reason:
        data.choices?.[0]?.message?.content ||
        "No AI explanation available.",
    })
  } catch (error) {
    console.error("AI MATCH ERROR:", error)

    return NextResponse.json(
      {
        error: "Failed to generate AI explanation.",
      },
      { status: 500 }
    )
  }
}