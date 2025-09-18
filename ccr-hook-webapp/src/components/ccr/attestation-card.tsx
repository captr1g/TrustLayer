'use client'

import { useState } from 'react'
import { motion } from 'framer-motion'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { Shield, Download, Upload, Clock, CheckCircle } from 'lucide-react'
import { PCSAttestation, CreditTier } from '@/lib/types'
import { cn } from '@/lib/utils'

interface AttestationCardProps {
  attestation: PCSAttestation
  variant?: 'compact' | 'detailed'
  showActions?: boolean
  onPublish?: () => void
  onDownload?: () => void
  onRefresh?: () => void
  className?: string
}

const tierColors: Record<CreditTier, string> = {
  bronze: 'tier-bronze',
  silver: 'tier-silver',
  gold: 'tier-gold',
  platinum: 'tier-platinum',
  diamond: 'tier-diamond'
}

const tierIcons: Record<CreditTier, string> = {
  bronze: '🥉',
  silver: '🥈',
  gold: '🥇',
  platinum: '💎',
  diamond: '💠'
}

export function AttestationCard({
  attestation,
  variant = 'detailed',
  showActions = true,
  onPublish,
  onDownload,
  onRefresh,
  className
}: AttestationCardProps) {
  const [isHovered, setIsHovered] = useState(false)

  const isExpired = new Date() > attestation.expiresAt
  const daysUntilExpiry = Math.ceil((attestation.expiresAt.getTime() - Date.now()) / (1000 * 60 * 60 * 24))

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      whileHover={{ y: -4, scale: 1.02 }}
      onHoverStart={() => setIsHovered(true)}
      onHoverEnd={() => setIsHovered(false)}
      className={cn('transition-all duration-300', className)}
    >
      <Card className={cn(
        'glass-card hover:glass-card-strong transition-all duration-300',
        isExpired && 'border-destructive/50 bg-destructive/5'
      )}>
        <CardHeader className="pb-4">
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg font-semibold flex items-center gap-2">
              <Shield className="h-5 w-5 text-primary" />
              Credit Attestation
              {attestation.published && (
                <CheckCircle className="h-4 w-4 text-green-500" />
              )}
            </CardTitle>
            <Badge
              variant="secondary"
              className={cn('text-sm font-medium', tierColors[attestation.tier])}
            >
              {tierIcons[attestation.tier]} {attestation.tier.toUpperCase()}
            </Badge>
          </div>
        </CardHeader>

        <CardContent className="space-y-4">
          {/* Credit Score Display */}
          <div className="text-center py-4">
            <motion.div
              animate={{ scale: isHovered ? 1.05 : 1 }}
              className="relative inline-block"
            >
              <div className="text-4xl font-bold text-primary font-mono">
                {attestation.score}
              </div>
              <div className="text-sm text-muted-foreground mt-1">
                Credit Score
              </div>
              {isHovered && (
                <motion.div
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="absolute -inset-2 bg-primary/20 rounded-full -z-10 animate-glow"
                />
              )}
            </motion.div>
          </div>

          {variant === 'detailed' && (
            <>
              {/* Attestation Details */}
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <div className="text-muted-foreground">Issued By</div>
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <div className="font-mono text-xs truncate cursor-help">
                          {attestation.operator}
                        </div>
                      </TooltipTrigger>
                      <TooltipContent>
                        <p>AVS Operator: {attestation.operator}</p>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                </div>
                <div>
                  <div className="text-muted-foreground">Status</div>
                  <div className="flex items-center gap-1">
                    {attestation.published ? (
                      <Badge variant="default" className="text-xs">
                        <CheckCircle className="h-3 w-3 mr-1" />
                        Published
                      </Badge>
                    ) : (
                      <Badge variant="outline" className="text-xs">
                        Local Only
                      </Badge>
                    )}
                  </div>
                </div>
              </div>

              {/* Expiry Information */}
              <div className="flex items-center gap-2 text-sm">
                <Clock className={cn(
                  'h-4 w-4',
                  isExpired ? 'text-destructive' : daysUntilExpiry <= 7 ? 'text-yellow-500' : 'text-muted-foreground'
                )} />
                <span className={cn(
                  isExpired ? 'text-destructive' : daysUntilExpiry <= 7 ? 'text-yellow-600' : 'text-muted-foreground'
                )}>
                  {isExpired
                    ? 'Expired'
                    : daysUntilExpiry <= 7
                      ? `Expires in ${daysUntilExpiry} day${daysUntilExpiry !== 1 ? 's' : ''}`
                      : `Valid until ${attestation.expiresAt.toLocaleDateString()}`
                  }
                </span>
              </div>
            </>
          )}

          {/* Action Buttons */}
          {showActions && (
            <div className="flex gap-2 pt-2">
              {!attestation.published && onPublish && (
                <Button onClick={onPublish} size="sm" className="flex-1">
                  <Upload className="h-4 w-4 mr-2" />
                  Publish On-Chain
                </Button>
              )}
              {onDownload && (
                <Button variant="outline" onClick={onDownload} size="sm">
                  <Download className="h-4 w-4 mr-2" />
                  Export
                </Button>
              )}
              {isExpired && onRefresh && (
                <Button variant="outline" onClick={onRefresh} size="sm">
                  <Shield className="h-4 w-4 mr-2" />
                  Refresh
                </Button>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </motion.div>
  )
}