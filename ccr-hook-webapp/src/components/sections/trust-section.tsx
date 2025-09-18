'use client'

import { motion } from 'framer-motion'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Shield,
  Users,
  Zap,
  GitBranch,
  ExternalLink,
  CheckCircle,
  ArrowRight
} from 'lucide-react'
import Link from 'next/link'

const partnerships = [
  {
    name: "EigenLayer",
    role: "AVS Infrastructure",
    description: "Providing secure, decentralized validation through Actively Validated Services",
    logo: "🔗",
    features: ["Restaking security", "Decentralized operators", "Cryptographic proofs"],
    status: "Integrated"
  },
  {
    name: "Fhenix",
    role: "FHE Technology",
    description: "Fully Homomorphic Encryption enabling computation on encrypted data",
    logo: "🔐",
    features: ["Privacy preservation", "Encrypted computation", "Zero knowledge"],
    status: "Integrated"
  },
  {
    name: "Uniswap v4",
    role: "Hook Integration",
    description: "Native integration with Uniswap v4 hooks for seamless DeFi experience",
    logo: "🦄",
    features: ["Hook architecture", "Swap optimization", "Pool integration"],
    status: "Beta"
  }
]

const metrics = [
  { label: "Security Audits", value: "3+", description: "Independent security reviews" },
  { label: "Uptime", value: "99.9%", description: "Network availability" },
  { label: "Processing Time", value: "<2s", description: "Average attestation speed" },
  { label: "Privacy Score", value: "A+", description: "Zero data exposure rating" }
]

const testimonials = [
  {
    quote: "CCR Hook represents the future of privacy-preserving DeFi. The ability to prove creditworthiness without exposing sensitive data is revolutionary.",
    author: "Alex Chen",
    role: "DeFi Researcher",
    avatar: "👨‍💻"
  },
  {
    quote: "The integration with Uniswap v4 hooks is seamless. Users get better rates while maintaining complete privacy - it's a win-win.",
    author: "Sarah Kim",
    role: "Protocol Developer",
    avatar: "👩‍🔬"
  },
  {
    quote: "As a privacy advocate, I'm impressed by the technical implementation. FHE ensures my financial data stays truly private.",
    author: "Marcus Johnson",
    role: "Security Expert",
    avatar: "🛡️"
  }
]

export function TrustSection() {
  return (
    <section className="py-24 px-4 sm:px-6 lg:px-8">
      <div className="max-w-7xl mx-auto">
        {/* Section Header */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8 }}
          viewport={{ once: true }}
          className="text-center mb-16"
        >
          <Badge
            variant="outline"
            className="glass-card border-green-300/30 text-green-600 mb-6 px-4 py-2"
          >
            <Shield className="h-3 w-3 mr-2" />
            Trusted by the Ecosystem
          </Badge>
          <h2 className="text-3xl md:text-5xl font-bold font-display mb-6">
            Built on{' '}
            <span className="bg-gradient-to-r from-primary to-secondary bg-clip-text text-transparent">
              Battle-Tested
            </span>{' '}
            Infrastructure
          </h2>
          <p className="text-xl text-muted-foreground max-w-3xl mx-auto text-balance">
            Partnering with industry leaders to deliver uncompromising security,
            privacy, and reliability for the next generation of DeFi.
          </p>
        </motion.div>

        {/* Partnership Cards */}
        <div className="grid md:grid-cols-3 gap-8 mb-20">
          {partnerships.map((partner, index) => (
            <motion.div
              key={index}
              initial={{ opacity: 0, y: 50 }}
              whileInView={{ opacity: 1, y: 0 }}
              transition={{
                duration: 0.6,
                delay: index * 0.2,
                ease: "easeOut"
              }}
              viewport={{ once: true }}
              whileHover={{ y: -8 }}
              className="group"
            >
              <Card className="glass-card hover:glass-card-strong transition-all duration-300 h-full border border-white/20 group-hover:border-white/30">
                <CardContent className="p-6 space-y-4">
                  {/* Partner Logo & Status */}
                  <div className="flex items-start justify-between">
                    <div className="text-4xl">{partner.logo}</div>
                    <Badge
                      variant={partner.status === 'Integrated' ? 'default' : 'secondary'}
                      className="text-xs"
                    >
                      {partner.status}
                    </Badge>
                  </div>

                  {/* Partner Info */}
                  <div>
                    <h3 className="text-xl font-semibold mb-1">{partner.name}</h3>
                    <p className="text-sm text-primary font-medium mb-2">{partner.role}</p>
                    <p className="text-sm text-muted-foreground leading-relaxed">
                      {partner.description}
                    </p>
                  </div>

                  {/* Features */}
                  <div className="space-y-2">
                    {partner.features.map((feature, featureIndex) => (
                      <div key={featureIndex} className="flex items-center gap-2 text-xs">
                        <CheckCircle className="h-3 w-3 text-green-500" />
                        <span className="text-muted-foreground">{feature}</span>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </div>

        {/* Metrics Grid */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.6 }}
          viewport={{ once: true }}
          className="grid grid-cols-2 md:grid-cols-4 gap-6 mb-20"
        >
          {metrics.map((metric, index) => (
            <motion.div
              key={index}
              initial={{ opacity: 0, scale: 0.9 }}
              whileInView={{ opacity: 1, scale: 1 }}
              transition={{
                duration: 0.5,
                delay: index * 0.1
              }}
              viewport={{ once: true }}
              className="text-center glass-card p-6 rounded-xl border border-white/20 hover:border-white/30 transition-all duration-300"
            >
              <div className="text-3xl font-bold text-primary mb-2">{metric.value}</div>
              <div className="font-medium text-sm mb-1">{metric.label}</div>
              <div className="text-xs text-muted-foreground">{metric.description}</div>
            </motion.div>
          ))}
        </motion.div>

        {/* Testimonials */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.8 }}
          viewport={{ once: true }}
          className="mb-16"
        >
          <h3 className="text-2xl font-semibold text-center mb-12">
            What the Community Says
          </h3>

          <div className="grid md:grid-cols-3 gap-8">
            {testimonials.map((testimonial, index) => (
              <motion.div
                key={index}
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                transition={{
                  duration: 0.6,
                  delay: index * 0.2
                }}
                viewport={{ once: true }}
                whileHover={{ y: -4 }}
              >
                <Card className="glass-card hover:glass-card-strong transition-all duration-300 border border-white/20">
                  <CardContent className="p-6">
                    <div className="text-2xl mb-4">{testimonial.avatar}</div>
                    <blockquote className="text-sm text-muted-foreground leading-relaxed mb-4 italic">
                      "{testimonial.quote}"
                    </blockquote>
                    <div>
                      <div className="font-medium text-sm">{testimonial.author}</div>
                      <div className="text-xs text-muted-foreground">{testimonial.role}</div>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </div>
        </motion.div>

        {/* Final CTA */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 1 }}
          viewport={{ once: true }}
          className="text-center"
        >
          <div className="glass-card p-8 rounded-2xl border border-white/20 max-w-4xl mx-auto">
            <h3 className="text-3xl font-bold mb-4">
              Ready to Join the Future of Private DeFi?
            </h3>
            <p className="text-muted-foreground mb-8 text-lg">
              Experience privacy-preserving credit scoring today. Your financial sovereignty starts here.
            </p>

            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Link href="/demo">
                <Button
                  size="lg"
                  className="group bg-gradient-to-r from-primary to-secondary hover:from-primary/90 hover:to-secondary/90 text-white shadow-lg hover:shadow-xl transition-all duration-300"
                >
                  <span className="flex items-center gap-2">
                    Start Demo
                    <ArrowRight className="h-4 w-4 group-hover:translate-x-1 transition-transform" />
                  </span>
                </Button>
              </Link>

              <Link href="/docs">
                <Button
                  variant="outline"
                  size="lg"
                  className="glass-card border-white/30 hover:bg-white/10 transition-all duration-300"
                >
                  <ExternalLink className="h-4 w-4 mr-2" />
                  Read Documentation
                </Button>
              </Link>
            </div>

            <div className="mt-8 flex items-center justify-center gap-4 text-sm text-muted-foreground">
              <span className="flex items-center gap-2">
                <GitBranch className="h-4 w-4" />
                Open Source
              </span>
              <span className="flex items-center gap-2">
                <Users className="h-4 w-4" />
                Community Driven
              </span>
              <span className="flex items-center gap-2">
                <Zap className="h-4 w-4" />
                Production Ready
              </span>
            </div>
          </div>
        </motion.div>
      </div>
    </section>
  )
}