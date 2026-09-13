"use client"

import { useState, useEffect, useMemo } from "react"
import { motion } from "framer-motion"
import {
  Search,
  Users,
  FolderGit2,
  UserPlus,
  MessageCircle,
  Check,
  Loader2,
  Sparkles,
} from "lucide-react"
import Link from "next/link"
import { toast } from "sonner"
import { supabase } from "@/lib/supabase/client"
import { calculateSkillMatch } from "@/lib/skill-matching"
import { useCurrentUser } from "@/lib/hooks/use-current-user"

export function DiscoverView() {
  const { user } = useCurrentUser()

  const [teammates, setTeammates] = useState<any[]>([])
  const [projects, setProjects] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [query, setQuery] = useState("")
  const [pendingConnections, setPendingConnections] = useState<Set<string>>(
    new Set()
  )
  const [connectingId, setConnectingId] = useState<string | null>(null)

  const [aiReasons, setAiReasons] = useState<Record<string, string>>({})
  const [aiLoading, setAiLoading] = useState<string | null>(null)

  const getAIMatchReason = async (
    projectId: string,
    studentSkills: string[],
    projectSkills: string[]
  ) => {
    if (aiReasons[projectId]) return

    setAiLoading(projectId)

    try {
      const response = await fetch("/api/ai-match", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          studentSkills,
          projectSkills,
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || "Failed to generate AI reason")
      }

      setAiReasons((prev) => ({
        ...prev,
        [projectId]: data.reason || "No AI explanation available.",
      }))
    } catch (error: any) {
      console.error("AI MATCH ERROR:", error)
      toast.error(error?.message || "Unable to generate AI explanation.")
    } finally {
      setAiLoading(null)
    }
  }

  useEffect(() => {
    if (!user) return

    const fetchData = async () => {
      try {
        const { data: mySkillsData } = await supabase
          .from("people_skills")
          .select("skills(name)")
          .eq("person_id", user.id)

        const studentSkills =
          mySkillsData
            ?.map((item: any) => item.skills?.name)
            .filter(Boolean) || []

        const [
          { data: peopleData },
          { data: projectsData },
          { data: existingConnections },
        ] = await Promise.all([
          supabase
            .from("people")
            .select(
              "id, full_name, role, year, people_skills(skills(name))"
            )
            .neq("id", user.id)
            .limit(20),

          supabase
            .from("projects")
            .select(
              "id, title, description, status, project_skills(skills(name)), team_members(person_id)"
            )
            .eq("visibility", "public")
            .order("created_at", { ascending: false })
            .limit(12),

          supabase
            .from("connections")
            .select("follower_id, following_id")
            .or(`follower_id.eq.${user.id},following_id.eq.${user.id}`),
        ])

        if (peopleData) {
          setTeammates(
            peopleData.map((p) => ({
              ...p,
              initials: p.full_name
                ? p.full_name
                    .split(" ")
                    .map((n: string) => n[0])
                    .join("")
                    .substring(0, 2)
                    .toUpperCase()
                : "?",
              tags:
                p.people_skills
                  ?.map((ps: any) => ps.skills?.name)
                  .filter(Boolean)
                  .slice(0, 2) || [],
            }))
          )
        }

        if (projectsData) {
          setProjects(
            projectsData.map((p) => {
              const projectSkills =
                p.project_skills
                  ?.map((ps: any) => ps.skills?.name)
                  .filter(Boolean) || []

              const match = calculateSkillMatch(
                studentSkills,
                projectSkills
              )

              return {
                ...p,
                teamCount: p.team_members?.length || 0,
                tags: projectSkills.slice(0, 3),
                matchScore: match.matchScore,
                matchedSkills: match.matchedSkills,
                missingSkills: match.missingSkills,
                studentSkills,
                projectSkills,
              }
            })
          )
        }

        if (existingConnections) {
          const ids = existingConnections.map((c: any) =>
            c.follower_id === user.id
              ? c.following_id
              : c.follower_id
          )

          setPendingConnections(new Set(ids))
        }
      } catch (error) {
        console.error("Error fetching discover data:", error)
      } finally {
        setLoading(false)
      }
    }

    fetchData()
  }, [user])

  const filteredTeammates = useMemo(() => {
    if (!query.trim()) return teammates

    const q = query.toLowerCase()

    return teammates.filter(
      (p) =>
        p.full_name?.toLowerCase().includes(q) ||
        p.tags.some((t: string) => t.toLowerCase().includes(q))
    )
  }, [teammates, query])

  const filteredProjects = useMemo(() => {
    if (!query.trim()) return projects

    const q = query.toLowerCase()

    return projects.filter(
      (p) =>
        p.title?.toLowerCase().includes(q) ||
        p.description?.toLowerCase().includes(q) ||
        p.tags.some((t: string) => t.toLowerCase().includes(q))
    )
  }, [projects, query])

  const handleConnect = async (personId: string) => {
    if (!user) return

    setConnectingId(personId)

    try {
      const { error } = await supabase.from("connections").insert({
        follower_id: user.id,
        following_id: personId,
        status: "pending",
      })

      if (error) throw error

      setPendingConnections((prev) => {
        const next = new Set(prev)
        next.add(personId)
        return next
      })

      toast.success("Connection request sent")
    } catch (err: any) {
      toast.error(err?.message || "Couldn't send connection request.")
    } finally {
      setConnectingId(null)
    }
  }

  const tones = ["aqua", "lilac", "peach", "ink"]

  return (
    <main className="relative min-h-dvh bg-[#e8e9e8] px-5 pb-32 pt-10 text-[#22393c] sm:px-8">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_18%_18%,rgba(255,255,255,.9),transparent_34%),radial-gradient(circle_at_88%_75%,rgba(196,213,211,.55),transparent_34%)]" />

      <div className="relative mx-auto w-full max-w-md">
        <motion.header
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-6"
        >
          <h1 className="text-2xl font-semibold tracking-tight">
            Discover
          </h1>

          <div className="glass-button glass-neutral mt-4 flex items-center gap-3 rounded-full px-5 py-3.5">
            <Search
              className="size-5 text-[#668184]"
              strokeWidth={1.8}
            />

            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search projects, skills, or people..."
              className="w-full bg-transparent text-sm font-medium text-[#22393c] placeholder:text-[#668184] focus:outline-none"
            />
          </div>
        </motion.header>

        {loading ? (
          <div className="flex justify-center py-20">
            <Loader2 className="size-10 animate-spin text-[#668184]" />
          </div>
        ) : (
          <>
            {/* PEOPLE */}

            <motion.section
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
              className="mb-8"
            >
              <h2 className="mb-4 flex items-center gap-2 text-lg font-semibold">
                <Users
                  className="size-5 text-[#8a9a7b]"
                  strokeWidth={1.8}
                />

                {query.trim()
                  ? "Matching People"
                  : "Recommended Teammates"}
              </h2>

              {filteredTeammates.length === 0 ? (
                <p className="text-sm text-[#668184]">
                  No people match "{query}".
                </p>
              ) : (
                <div className="space-y-3">
                  {filteredTeammates.map((person, idx) => {
                    const isPending = pendingConnections.has(person.id)

                    return (
                      <div
                        key={person.id}
                        className={`glass-button glass-${
                          tones[idx % tones.length]
                        } flex items-center justify-between rounded-3xl p-4`}
                      >
                        <Link
                          href={`/profile/${person.id}`}
                          className="flex min-w-0 flex-1 items-center gap-3"
                        >
                          <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-[#22393c]/10 text-xs font-bold text-[#22393c]">
                            {person.initials}
                          </div>

                          <div className="min-w-0">
                            <p className="truncate text-sm font-semibold">
                              {person.full_name}
                            </p>

                            <p className="text-xs text-[#668184]">
                              {person.role || "Student"} ·{" "}
                              {person.year || ""} Year
                            </p>
                          </div>
                        </Link>

                        <div className="flex flex-shrink-0 items-center gap-2">
                          <div className="hidden gap-1 sm:flex">
                            {person.tags.map((tag: string) => (
                              <span
                                key={tag}
                                className="rounded-full bg-white/50 px-2 py-0.5 text-[10px] font-medium text-[#22393c]"
                              >
                                {tag}
                              </span>
                            ))}
                          </div>

                          <button
                            onClick={() => handleConnect(person.id)}
                            disabled={
                              isPending ||
                              connectingId === person.id
                            }
                            title={
                              isPending
                                ? "Request pending"
                                : "Connect"
                            }
                            className="flex h-8 w-8 items-center justify-center rounded-full bg-[#22393c] text-white transition-transform hover:scale-105 disabled:opacity-50"
                          >
                            {connectingId === person.id ? (
                              <Loader2 className="size-4 animate-spin" />
                            ) : isPending ? (
                              <Check
                                className="size-4"
                                strokeWidth={2}
                              />
                            ) : (
                              <UserPlus
                                className="size-4"
                                strokeWidth={2}
                              />
                            )}
                          </button>

                          <Link href={`/chat/${person.id}`}>
                            <button className="flex h-8 w-8 items-center justify-center rounded-full bg-[#22393c]/10 text-[#22393c] transition-transform hover:scale-105">
                              <MessageCircle
                                className="size-4"
                                strokeWidth={2}
                              />
                            </button>
                          </Link>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </motion.section>

            {/* PROJECTS */}

            <motion.section
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
            >
              <div className="mb-4 flex items-center justify-between">
                <h2 className="flex items-center gap-2 text-lg font-semibold">
                  <FolderGit2
                    className="size-5 text-[#8a9a7b]"
                    strokeWidth={1.8}
                  />

                  {query.trim()
                    ? "Matching Projects"
                    : "Trending Projects"}
                </h2>

                <Link
                  href="/projects"
                  className="text-xs font-semibold uppercase tracking-wider text-[#668184] hover:text-[#22393c]"
                >
                  View All
                </Link>
              </div>

              {filteredProjects.length === 0 ? (
                <p className="text-sm text-[#668184]">
                  No projects match "{query}".
                </p>
              ) : (
                <div className="-mx-5 flex snap-x snap-mandatory gap-3 overflow-x-auto px-5 pb-4 scrollbar-hide">
                  {filteredProjects.map((project, idx) => (
                    <div
                      key={project.id}
                      className="w-64 flex-shrink-0 snap-center"
                    >
                      <div
                        className={`glass-button glass-${
                          tones[idx % tones.length]
                        } rounded-3xl p-4 transition-transform hover:-translate-y-1`}
                      >
                        <Link
                          href={`/projects/${project.id}`}
                          className="block cursor-pointer"
                        >
                          <div className="mb-2 flex items-start justify-between">
                            <h3 className="line-clamp-1 text-sm font-bold leading-tight text-[#22393c]">
                              {project.title}
                            </h3>

                            <span className="ml-2 flex-shrink-0 rounded-full bg-[#8a9a7b]/20 px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider text-[#22393c]">
                              {project.status || "Active"}
                            </span>
                          </div>

                          <p className="mb-3 line-clamp-3 text-[11px] leading-relaxed text-[#22393c]/80">
                            {project.description ||
                              "No description provided."}
                          </p>

                          <div className="mb-3 flex items-center justify-between">
                            <span className="rounded-full bg-white/60 px-2 py-1 text-[10px] font-bold">
                              {project.matchScore}% Match
                            </span>

                            {project.matchedSkills?.length > 0 && (
                              <span className="text-[9px] font-semibold text-[#668184]">
                                {project.matchedSkills.length} skill
                                {project.matchedSkills.length > 1
                                  ? "s"
                                  : ""}{" "}
                                matched
                              </span>
                            )}
                          </div>

                          <div className="mb-3 flex flex-wrap gap-1">
                            {project.tags
                              .slice(0, 3)
                              .map((tag: string) => (
                                <span
                                  key={tag}
                                  className="rounded-full bg-white/60 px-1.5 py-0.5 text-[9px] font-semibold text-[#22393c]"
                                >
                                  {tag}
                                </span>
                              ))}
                          </div>
                        </Link>

                        {/* AI MATCH REASON */}

                        <div className="border-t border-[#22393c]/5 pt-3">
                          <button
                            onClick={() =>
                              getAIMatchReason(
                                project.id,
                                project.studentSkills || [],
                                project.projectSkills || []
                              )
                            }
                            disabled={aiLoading === project.id}
                            className="flex w-full items-center justify-center gap-2 rounded-full bg-[#22393c] px-3 py-2 text-[10px] font-semibold text-white transition-transform hover:scale-[1.02] disabled:opacity-60"
                          >
                            {aiLoading === project.id ? (
                              <>
                                <Loader2 className="size-3 animate-spin" />
                                Generating AI Reason...
                              </>
                            ) : (
                              <>
                                <Sparkles className="size-3" />
                                {aiReasons[project.id]
                                  ? "AI Match Reason"
                                  : "Get AI Match Reason"}
                              </>
                            )}
                          </button>

                          {aiReasons[project.id] && (
                            <div className="mt-2 rounded-2xl bg-white/50 p-3">
                              <p className="mb-1 text-[9px] font-bold uppercase tracking-wider text-[#668184]">
                                AI Insight
                              </p>

                              <p className="text-[10px] leading-relaxed text-[#22393c]/80">
                                {aiReasons[project.id]}
                              </p>
                            </div>
                          )}
                        </div>

                        <div className="mt-3 flex items-center justify-between border-t border-[#22393c]/5 pt-2">
                          <span className="text-[10px] font-medium text-[#668184]">
                            Team: {project.teamCount}
                          </span>

                          <div className="flex flex-wrap justify-end gap-1">
                            {project.tags
                              .slice(0, 2)
                              .map((tag: string) => (
                                <span
                                  key={tag}
                                  className="rounded-full bg-white/60 px-1.5 py-0.5 text-[9px] font-semibold text-[#22393c]"
                                >
                                  {tag}
                                </span>
                              ))}
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </motion.section>
          </>
        )}
      </div>
    </main>
  )
}