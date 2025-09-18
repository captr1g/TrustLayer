'use client'

import { motion } from 'framer-motion'
import { Card, CardContent } from '@/components/ui/card'
import { Shield, Lock, Zap, CheckCircle } from 'lucide-react'

const steps = [
  {
    icon: Shield,
    title: "Connect Your Wallet",
    description: "Link your Web3 wallet to analyze your on-chain activity. Your data never leaves your device.",
    details: ["Transaction history", "LP positions", "DeFi interactions"],
    color: "from-blue-500 to-cyan-500"
  },
  {
    icon: Lock,
    title: "Encrypted Processing",
    description: "Your data is encrypted locally using Fully Homomorphic Encryption before any computation.",
    details: ["Client-side encryption", "Zero data exposure", "Privacy guaranteed"],
    color: "from-purple-500 to-pink-500"
  },
  {
    icon: Zap,
    title: "AVS Validation",
    description: "EigenLayer AVS operators compute your credit score on encrypted data without seeing it.",
    details: ["Decentralized validation", "Cryptographic proofs", "Tamper-resistant"],
    color: "from-green-500 to-emerald-500"
  },
  {
    icon: CheckCircle,
    title: "Receive Credit Tier",
    description: "Get your signed attestation and unlock better swap conditions across supported pools.",
    details: ["Signed attestation", "Better rates", "Enhanced limits"],
    color: "from-orange-500 to-red-500"
  }
]

export function HowItWorksSection() {
  return (
    <section className="py-24 px-4 sm:px-6 lg:px-8">
      <div className="max-w-7xl mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8 }}
          viewport={{ once: true }}
          className="text-center mb-16"
        >
          <h2 className="text-3xl md:text-5xl font-bold font-display mb-6">
            How It Works
          </h2>
          <p className="text-xl text-muted-foreground max-w-3xl mx-auto text-balance">
            Our privacy-first approach ensures your financial data remains confidential while
            providing verifiable credit assessments for better DeFi experiences.
          </p>
        </motion.div>

        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-8">
          {steps.map((step, index) => {
            const Icon = step.icon
            return (
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
                className="relative group"
              >
                <Card className="glass-card hover:glass-card-strong transition-all duration-300 h-full border border-white/20 group-hover:border-white/30">
                  <CardContent className="p-6 space-y-4">
                    {/* Icon with gradient background */}
                    <div className={`w-16 h-16 rounded-2xl bg-gradient-to-br ${step.color} p-4 mx-auto mb-4 group-hover:scale-110 transition-transform duration-300`}>
                      <Icon className="w-full h-full text-white" />
                    </div>

                    {/* Step Number */}
                    <div className="text-center">
                      <span className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-primary/20 text-primary font-bold text-sm mb-3">
                        {index + 1}
                      </span>
                    </div>

                    {/* Content */}
                    <div className="text-center space-y-3">
                      <h3 className="text-xl font-semibold">{step.title}</h3>
                      <p className="text-muted-foreground text-sm leading-relaxed">
                        {step.description}
                      </p>
                    </div>

                    {/* Details */}
                    <div className="space-y-2">
                      {step.details.map((detail, detailIndex) => (
                        <motion.div
                          key={detailIndex}
                          initial={{ opacity: 0, x: -20 }}
                          whileInView={{ opacity: 1, x: 0 }}
                          transition={{
                            delay: index * 0.2 + detailIndex * 0.1,
                            duration: 0.4
                          }}
                          viewport={{ once: true }}
                          className="flex items-center gap-2 text-xs text-muted-foreground"
                        >
                          <div className="w-1.5 h-1.5 rounded-full bg-primary/60" />
                          {detail}
                        </motion.div>
                      ))}
                    </div>
                  </CardContent>
                </Card>

                {/* Connection Line (hidden on mobile) */}
                {index < steps.length - 1 && (
                  <motion.div
                    initial={{ scaleX: 0 }}
                    whileInView={{ scaleX: 1 }}
                    transition={{
                      delay: index * 0.2 + 0.5,
                      duration: 0.8
                    }}
                    viewport={{ once: true }}
                    className="hidden lg:block absolute top-1/2 -right-4 w-8 h-0.5 bg-gradient-to-r from-primary/60 to-transparent transform -translate-y-1/2 z-10"
                  />
                )}
              </motion.div>
            )
          })}
        </div>

        {/* Bottom CTA */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.8 }}
          viewport={{ once: true }}
          className="text-center mt-16"
        >
          <div className="glass-card p-8 rounded-2xl border border-white/20 max-w-2xl mx-auto">
            <h3 className="text-2xl font-semibold mb-4">
              Ready to enhance your DeFi experience?
            </h3>
            <p className="text-muted-foreground mb-6">
              Join the beta and experience privacy-preserving credit scoring today.
            </p>
            <motion.div
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              className="inline-block"
            >
              <button className="bg-gradient-to-r from-primary to-secondary text-white px-8 py-3 rounded-xl font-medium shadow-lg hover:shadow-xl transition-all duration-300">
                Start Demo
              </button>
            </motion.div>
          </div>
        </motion.div>
      </div>
    </section>
  )
}