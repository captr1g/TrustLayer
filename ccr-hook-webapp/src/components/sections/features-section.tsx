'use client'

import { motion } from 'framer-motion'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import {
  Shield,
  Eye,
  Zap,
  TrendingUp,
  Users,
  Lock,
  Award,
  BarChart3,
  ArrowUpDown
} from 'lucide-react'

const features = [
  {
    icon: Shield,
    title: "Privacy by Design",
    description: "Your financial data never leaves your device. All computations happen on encrypted data using Fully Homomorphic Encryption.",
    benefits: ["Zero data exposure", "Client-side encryption", "Cryptographic guarantees"],
    category: "Privacy"
  },
  {
    icon: TrendingUp,
    title: "Better Swap Conditions",
    description: "Higher credit tiers unlock better rates, higher limits, and reduced fees across supported Uniswap v4 pools.",
    benefits: ["Reduced trading fees", "Higher swap limits", "Priority access"],
    category: "Benefits"
  },
  {
    icon: Zap,
    title: "Instant Verification",
    description: "Get your credit attestation in seconds through our decentralized AVS network powered by EigenLayer.",
    benefits: ["Sub-second processing", "Real-time updates", "Always available"],
    category: "Performance"
  },
  {
    icon: Users,
    title: "Decentralized Network",
    description: "Built on EigenLayer's robust AVS infrastructure with multiple operators ensuring security and reliability.",
    benefits: ["No single point of failure", "Cryptographic proofs", "Community governed"],
    category: "Infrastructure"
  },
  {
    icon: Award,
    title: "Gamified Experience",
    description: "Earn XP, unlock achievements, and climb the leaderboard while maintaining your privacy and improving your credit tier.",
    benefits: ["XP rewards system", "Achievement badges", "Social features"],
    category: "Engagement"
  },
  {
    icon: BarChart3,
    title: "Pool Risk Assessment",
    description: "View real-time risk assessments for all supported pools with personalized recommendations based on your credit tier.",
    benefits: ["Risk visualization", "Personalized insights", "Pool recommendations"],
    category: "Analytics"
  }
]

const categoryColors = {
  "Privacy": "from-blue-500 to-cyan-500",
  "Benefits": "from-green-500 to-emerald-500",
  "Performance": "from-purple-500 to-pink-500",
  "Infrastructure": "from-orange-500 to-red-500",
  "Engagement": "from-yellow-500 to-orange-500",
  "Analytics": "from-indigo-500 to-purple-500"
}

export function FeaturesSection() {
  return (
    <section className="py-24 px-4 sm:px-6 lg:px-8 bg-gradient-to-b from-transparent to-muted/20">
      <div className="max-w-7xl mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8 }}
          viewport={{ once: true }}
          className="text-center mb-16"
        >
          <Badge
            variant="outline"
            className="glass-card border-secondary/30 text-secondary mb-6 px-4 py-2"
          >
            <Eye className="h-3 w-3 mr-2" />
            Feature Spotlight
          </Badge>
          <h2 className="text-3xl md:text-5xl font-bold font-display mb-6">
            Built for the Future of{' '}
            <span className="bg-gradient-to-r from-primary to-secondary bg-clip-text text-transparent">
              Private DeFi
            </span>
          </h2>
          <p className="text-xl text-muted-foreground max-w-3xl mx-auto text-balance">
            Experience the next generation of DeFi with privacy-preserving technology
            that puts you in control of your financial data.
          </p>
        </motion.div>

        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
          {features.map((feature, index) => {
            const Icon = feature.icon
            const gradientClass = categoryColors[feature.category as keyof typeof categoryColors]

            return (
              <motion.div
                key={index}
                initial={{ opacity: 0, y: 50 }}
                whileInView={{ opacity: 1, y: 0 }}
                transition={{
                  duration: 0.6,
                  delay: index * 0.1,
                  ease: "easeOut"
                }}
                viewport={{ once: true }}
                whileHover={{ y: -8, scale: 1.02 }}
                className="group"
              >
                <Card className="glass-card hover:glass-card-strong transition-all duration-300 h-full border border-white/20 group-hover:border-white/30 relative overflow-hidden">
                  {/* Background Gradient Effect */}
                  <motion.div
                    initial={{ opacity: 0 }}
                    whileHover={{ opacity: 0.1 }}
                    transition={{ duration: 0.3 }}
                    className={`absolute inset-0 bg-gradient-to-br ${gradientClass} pointer-events-none`}
                  />

                  <CardHeader className="relative">
                    {/* Category Badge */}
                    <Badge
                      variant="outline"
                      className="w-fit mb-4 text-xs border-white/30 text-muted-foreground"
                    >
                      {feature.category}
                    </Badge>

                    {/* Icon */}
                    <div className={`w-14 h-14 rounded-2xl bg-gradient-to-br ${gradientClass} p-3 mb-4 group-hover:scale-110 transition-transform duration-300`}>
                      <Icon className="w-full h-full text-white" />
                    </div>

                    <CardTitle className="text-xl font-semibold">
                      {feature.title}
                    </CardTitle>
                  </CardHeader>

                  <CardContent className="relative space-y-4">
                    <p className="text-muted-foreground text-sm leading-relaxed">
                      {feature.description}
                    </p>

                    {/* Benefits List */}
                    <div className="space-y-2">
                      {feature.benefits.map((benefit, benefitIndex) => (
                        <motion.div
                          key={benefitIndex}
                          initial={{ opacity: 0, x: -20 }}
                          whileInView={{ opacity: 1, x: 0 }}
                          transition={{
                            delay: index * 0.1 + benefitIndex * 0.1,
                            duration: 0.4
                          }}
                          viewport={{ once: true }}
                          className="flex items-center gap-2 text-xs"
                        >
                          <div className={`w-1.5 h-1.5 rounded-full bg-gradient-to-r ${gradientClass}`} />
                          <span className="text-muted-foreground">{benefit}</span>
                        </motion.div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            )
          })}
        </div>

        {/* Feature Comparison */}
        <motion.div
          initial={{ opacity: 0, y: 50 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.6 }}
          viewport={{ once: true }}
          className="mt-20"
        >
          <div className="glass-card p-8 rounded-2xl border border-white/20">
            <h3 className="text-2xl font-semibold text-center mb-8">
              Why Choose CCR Hook?
            </h3>

            <div className="grid md:grid-cols-3 gap-8">
              {[
                {
                  title: "Traditional Credit Scoring",
                  items: ["Centralized data collection", "Privacy concerns", "Limited to TradFi", "Slow processing"],
                  highlight: false
                },
                {
                  title: "CCR Hook",
                  items: ["Privacy-preserving", "Decentralized validation", "DeFi native", "Instant verification"],
                  highlight: true
                },
                {
                  title: "Other DeFi Solutions",
                  items: ["Limited privacy", "Basic scoring", "Single protocol", "Manual verification"],
                  highlight: false
                }
              ].map((column, index) => (
                <div
                  key={index}
                  className={`space-y-4 p-6 rounded-xl border transition-all duration-300 ${
                    column.highlight
                      ? 'border-primary/50 bg-primary/5 shadow-lg'
                      : 'border-white/20 bg-white/5'
                  }`}
                >
                  <h4 className={`font-semibold text-center ${
                    column.highlight ? 'text-primary' : 'text-foreground'
                  }`}>
                    {column.title}
                  </h4>
                  <div className="space-y-2">
                    {column.items.map((item, itemIndex) => (
                      <div key={itemIndex} className="flex items-center gap-2 text-sm">
                        {column.highlight ? (
                          <div className="w-1.5 h-1.5 rounded-full bg-primary" />
                        ) : (
                          <div className="w-1.5 h-1.5 rounded-full bg-muted-foreground/50" />
                        )}
                        <span className={column.highlight ? 'text-foreground' : 'text-muted-foreground'}>
                          {item}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </motion.div>
      </div>
    </section>
  )
}