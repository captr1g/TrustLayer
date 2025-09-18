'use client'

import { motion } from 'framer-motion'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { ArrowRight, Shield, Lock, Zap, TrendingUp } from 'lucide-react'

// Predetermined positions and animations for consistent SSR/CSR rendering
const floatingElements = [
  { left: 15, top: 20, x: 30, y: -20, duration: 4, delay: 0 },
  { left: 85, top: 15, x: -25, y: 40, duration: 3.5, delay: 0.5 },
  { left: 25, top: 75, x: 20, y: -30, duration: 4.5, delay: 1 },
  { left: 75, top: 80, x: -40, y: 25, duration: 3, delay: 1.5 },
  { left: 60, top: 35, x: 35, y: -15, duration: 4.2, delay: 0.8 },
  { left: 40, top: 90, x: -20, y: 30, duration: 3.8, delay: 0.3 },
]

export function HeroSection() {
  return (
    <section className="relative min-h-screen flex items-center justify-center overflow-hidden">
      {/* Animated Background Elements */}
      <div className="absolute inset-0 -z-10">
        {/* Floating Elements */}
        {floatingElements.map((element, i) => (
          <motion.div
            key={i}
            className="absolute w-2 h-2 bg-primary/20 rounded-full"
            animate={{
              x: [0, element.x],
              y: [0, element.y],
              opacity: [0.2, 0.8, 0.2],
            }}
            transition={{
              duration: element.duration,
              repeat: Infinity,
              delay: element.delay,
            }}
            style={{
              left: `${element.left}%`,
              top: `${element.top}%`,
            }}
          />
        ))}
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="grid lg:grid-cols-2 gap-12 items-center">
          {/* Left Column - Content */}
          <motion.div
            initial={{ opacity: 0, x: -50 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.8, ease: "easeOut" }}
            className="space-y-8"
          >
            {/* Beta Badge */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2, duration: 0.6 }}
            >
              <Badge
                variant="outline"
                className="glass-card border-primary/30 text-primary hover:bg-primary/10 transition-colors px-4 py-2"
              >
                <Zap className="h-3 w-3 mr-2" />
                Now in Beta • Built on Uniswap v4
              </Badge>
            </motion.div>

            {/* Main Headline */}
            <motion.div
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.4, duration: 0.8 }}
              className="space-y-4"
            >
              <h1 className="text-4xl md:text-6xl lg:text-7xl font-bold font-display leading-tight">
                <span className="text-balance">
                  Get Your{' '}
                  <span className="bg-gradient-to-r from-primary via-secondary to-primary bg-clip-text text-transparent -  animate-glow">
                    Private Credit Tier
                  </span>
                </span>
              </h1>
              <p className="text-xl md:text-2xl text-muted-foreground text-balance leading-relaxed">
                Unlock better swap conditions with privacy-preserving credit scoring.
                Your financial data stays <strong className="text-foreground">completely private</strong>.
              </p>
            </motion.div>

            {/* Key Benefits */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.6, duration: 0.6 }}
              className="flex flex-wrap gap-4"
            >
              {[
                { icon: Shield, text: "Privacy-First" },
                { icon: Lock, text: "FHE Encrypted" },
                { icon: TrendingUp, text: "Better Rates" },
              ].map((item, index) => (
                <div key={index} className="flex items-center gap-2 glass-card px-4 py-2 rounded-full">
                  <item.icon className="h-4 w-4 text-primary" />
                  <span className="text-sm font-medium">{item.text}</span>
                </div>
              ))}
            </motion.div>

            {/* CTA Buttons */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.8, duration: 0.6 }}
              className="flex flex-col sm:flex-row gap-4"
            >
              <Link href="/demo">
                <Button
                  size="lg"
                  className="group relative overflow-hidden bg-gradient-to-r from-primary to-secondary hover:from-primary/90 hover:to-secondary/90 text-white shadow-lg hover:shadow-xl transition-all duration-300"
                >
                  <span className="relative z-10 flex items-center gap-2">
                    Get Started
                    <ArrowRight className="h-4 w-4 group-hover:translate-x-1 transition-transform" />
                  </span>
                  <motion.div
                    className="absolute inset-0 bg-gradient-to-r from-white/20 to-transparent"
                    initial={{ x: "-100%" }}
                    whileHover={{ x: "100%" }}
                    transition={{ duration: 0.6 }}
                  />
                </Button>
              </Link>

              <Link href="/docs">
                <Button
                  variant="outline"
                  size="lg"
                  className="glass-card border-white/30 hover:bg-white/10 transition-all duration-300"
                >
                  View Documentation
                </Button>
              </Link>
            </motion.div>

            {/* Trust Indicators */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 1, duration: 0.6 }}
              className="pt-8"
            >
              <p className="text-sm text-muted-foreground mb-4">Powered by industry leaders</p>
              <div className="flex items-center gap-6 opacity-60">
                {['EigenLayer', 'Fhenix', 'Uniswap'].map((partner, index) => (
                  <div key={index} className="text-sm font-medium">{partner}</div>
                ))}
              </div>
            </motion.div>
          </motion.div>

          {/* Right Column - Interactive Demo */}
          <motion.div
            initial={{ opacity: 0, x: 50 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.8, delay: 0.3, ease: "easeOut" }}
            className="relative"
          >
            {/* Demo Card */}
            <div className="glass-card-strong p-8 rounded-3xl border border-white/30 relative overflow-hidden">
              {/* Animated Pipeline */}
              <div className="space-y-6">
                <h3 className="text-xl font-semibold text-center mb-8">Live Demo Preview</h3>

                {/* Pipeline Steps */}
                {[
                  { icon: "🔗", title: "Connect Wallet", desc: "Link your Web3 wallet", active: true },
                  { icon: "🔒", title: "Encrypt Data", desc: "Local FHE encryption", active: false },
                  { icon: "⚡", title: "AVS Processing", desc: "Secure computation", active: false },
                  { icon: "🏆", title: "Get Credit Tier", desc: "Receive attestation", active: false },
                ].map((step, index) => (
                  <motion.div
                    key={index}
                    initial={{ opacity: 0.3, scale: 0.95 }}
                    animate={{
                      opacity: step.active ? 1 : 0.6,
                      scale: step.active ? 1 : 0.95,
                    }}
                    transition={{ delay: index * 0.2 }}
                    className={`flex items-center gap-4 p-4 rounded-xl transition-all duration-300 ${
                      step.active ? 'glass-card border border-primary/30 shadow-lg' : 'bg-muted/10'
                    }`}
                  >
                    <div className="text-2xl">{step.icon}</div>
                    <div className="flex-1">
                      <div className="font-medium">{step.title}</div>
                      <div className="text-sm text-muted-foreground">{step.desc}</div>
                    </div>
                    {step.active && (
                      <motion.div
                        animate={{ rotate: 360 }}
                        transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
                        className="w-4 h-4 border-2 border-primary border-t-transparent rounded-full"
                      />
                    )}
                  </motion.div>
                ))}
              </div>

              {/* Floating Particles */}
              {[...Array(3)].map((_, i) => (
                <motion.div
                  key={i}
                  className="absolute w-1 h-1 bg-primary/40 rounded-full"
                  animate={{
                    y: [0, -20, 0],
                    opacity: [0.4, 1, 0.4],
                  }}
                  transition={{
                    duration: 2,
                    repeat: Infinity,
                    delay: i * 0.7,
                  }}
                  style={{
                    left: `${20 + i * 30}%`,
                    top: `${80}%`,
                  }}
                />
              ))}
            </div>

            {/* Background Decoration */}
            <motion.div
              animate={{ rotate: 360 }}
              transition={{ duration: 20, repeat: Infinity, ease: "linear" }}
              className="absolute -top-4 -right-4 w-24 h-24 bg-gradient-to-r from-primary/20 to-secondary/20 rounded-full blur-xl -z-10"
            />
          </motion.div>
        </div>
      </div>
    </section>
  )
}