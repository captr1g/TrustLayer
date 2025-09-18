'use client'

import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Progress } from '@/components/ui/progress'
import { Badge } from '@/components/ui/badge'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { Star, Trophy, Zap, TrendingUp } from 'lucide-react'
import { UserXP, Badge as UserBadge } from '@/lib/types'
import { cn } from '@/lib/utils'

interface XPProgressProps {
  userXP: UserXP
  showBadges?: boolean
  variant?: 'compact' | 'detailed'
  className?: string
}

const levelThresholds = [0, 100, 250, 500, 1000, 2000, 4000, 8000, 15000, 30000, 50000]

const getLevelInfo = (level: number) => {
  const titles = [
    'Newcomer', 'Explorer', 'Trader', 'Strategist', 'Expert',
    'Master', 'Veteran', 'Elite', 'Legend', 'Pioneer', 'Grandmaster'
  ]

  const colors = [
    'text-gray-600', 'text-green-600', 'text-blue-600', 'text-purple-600', 'text-orange-600',
    'text-red-600', 'text-pink-600', 'text-indigo-600', 'text-yellow-600', 'text-cyan-600', 'text-emerald-600'
  ]

  return {
    title: titles[Math.min(level, titles.length - 1)] || 'Grandmaster',
    color: colors[Math.min(level, colors.length - 1)] || 'text-emerald-600'
  }
}

export function XPProgress({
  userXP,
  showBadges = true,
  variant = 'detailed',
  className
}: XPProgressProps) {
  const [animatedXP, setAnimatedXP] = useState(0)
  const [isHovered, setIsHovered] = useState(false)

  const progressPercentage = (userXP.currentXP / userXP.xpToNextLevel) * 100
  const levelInfo = getLevelInfo(userXP.level)

  useEffect(() => {
    const timer = setTimeout(() => {
      setAnimatedXP(userXP.currentXP)
    }, 300)
    return () => clearTimeout(timer)
  }, [userXP.currentXP])

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      onHoverStart={() => setIsHovered(true)}
      onHoverEnd={() => setIsHovered(false)}
      className={cn('transition-all duration-300', className)}
    >
      <Card className="glass-card hover:glass-card-strong transition-all duration-300">
        <CardHeader className="pb-3">
          <CardTitle className="text-lg font-semibold flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className={cn(
                'w-8 h-8 rounded-full flex items-center justify-center transition-all duration-300',
                isHovered ? 'animate-glow' : '',
                'bg-gradient-to-r from-primary to-secondary'
              )}>
                <Star className="h-4 w-4 text-white" />
              </div>
              <span>Level {userXP.level}</span>
            </div>
            <Badge variant="outline" className={cn('text-sm font-medium', levelInfo.color)}>
              {levelInfo.title}
            </Badge>
          </CardTitle>
        </CardHeader>

        <CardContent className="space-y-4">
          {/* XP Progress Bar */}
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Progress to Level {userXP.level + 1}</span>
              <span className="font-medium">
                {animatedXP.toLocaleString()} / {userXP.xpToNextLevel.toLocaleString()} XP
              </span>
            </div>

            <div className="relative">
              <Progress
                value={progressPercentage}
                className="h-3 bg-muted/30"
              />

              {/* Animated Progress Fill */}
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: `${progressPercentage}%` }}
                transition={{ duration: 1, delay: 0.5, ease: "easeOut" }}
                className="absolute top-0 left-0 h-3 bg-gradient-to-r from-primary via-secondary to-primary rounded-full"
              />

              {/* Sparkle Effect on Hover */}
              {isHovered && (
                <motion.div
                  initial={{ scale: 0, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  className="absolute -top-1 -right-1 w-5 h-5"
                >
                  <Zap className="h-4 w-4 text-yellow-400 animate-pulse" />
                </motion.div>
              )}
            </div>
          </div>

          {variant === 'detailed' && (
            <>
              {/* XP Stats */}
              <div className="grid grid-cols-2 gap-4 pt-2">
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <div className="text-center p-2 rounded-lg bg-muted/20 cursor-help transition-colors hover:bg-muted/30">
                        <div className="text-lg font-bold text-primary">
                          {userXP.totalXP.toLocaleString()}
                        </div>
                        <div className="text-xs text-muted-foreground">Total XP</div>
                      </div>
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>Total experience points earned</p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>

                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <div className="text-center p-2 rounded-lg bg-muted/20 cursor-help transition-colors hover:bg-muted/30">
                        <div className="text-lg font-bold text-secondary flex items-center justify-center gap-1">
                          <Trophy className="h-4 w-4" />
                          {userXP.badges.length}
                        </div>
                        <div className="text-xs text-muted-foreground">Badges</div>
                      </div>
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>Achievements unlocked</p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              </div>

              {/* Recent Badges */}
              {showBadges && userXP.badges.length > 0 && (
                <div className="space-y-2">
                  <div className="text-sm font-medium flex items-center gap-2">
                    <Trophy className="h-4 w-4 text-yellow-500" />
                    Recent Achievements
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {userXP.badges.slice(0, 3).map((badge) => (
                      <TooltipProvider key={badge.id}>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <motion.div
                              whileHover={{ scale: 1.1 }}
                              whileTap={{ scale: 0.95 }}
                              className="flex items-center gap-1 px-2 py-1 rounded-md bg-muted/30 border border-muted cursor-help"
                            >
                              <span className="text-xs">{badge.icon}</span>
                              <span className="text-xs font-medium truncate max-w-20">
                                {badge.name}
                              </span>
                            </motion.div>
                          </TooltipTrigger>
                          <TooltipContent className="max-w-48">
                            <div className="space-y-1">
                              <p className="font-medium">{badge.name}</p>
                              <p className="text-xs text-muted-foreground">{badge.description}</p>
                              {badge.unlockedAt && (
                                <p className="text-xs text-muted-foreground">
                                  Unlocked: {badge.unlockedAt.toLocaleDateString()}
                                </p>
                              )}
                            </div>
                          </TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                    ))}
                    {userXP.badges.length > 3 && (
                      <div className="flex items-center justify-center px-2 py-1 rounded-md bg-muted/20 border border-muted">
                        <span className="text-xs text-muted-foreground">
                          +{userXP.badges.length - 3} more
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Next Level Preview */}
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 1 }}
                className="flex items-center gap-2 text-xs text-muted-foreground border-t pt-3"
              >
                <TrendingUp className="h-3 w-3" />
                <span>
                  {userXP.xpToNextLevel - userXP.currentXP} XP to reach {getLevelInfo(userXP.level + 1).title}
                </span>
              </motion.div>
            </>
          )}
        </CardContent>
      </Card>
    </motion.div>
  )
}