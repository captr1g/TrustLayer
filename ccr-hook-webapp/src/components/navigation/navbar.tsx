'use client'

import { useState } from 'react'
import Link from 'next/link'
import { motion } from 'framer-motion'
import { ConnectButton } from '@rainbow-me/rainbowkit'
import { Button } from '@/components/ui/button'
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet'
import { Badge } from '@/components/ui/badge'
import { Menu, Shield, Home, Users, BookOpen, PlayCircle, BarChart3, User } from 'lucide-react'
import { cn } from '@/lib/utils'

const navigation = [
  { name: 'Home', href: '/', icon: Home },
  { name: 'Demo', href: '/demo', icon: PlayCircle },
  { name: 'Dashboard', href: '/dashboard', icon: User },
  { name: 'Pools', href: '/pools', icon: BarChart3 },
  { name: 'For Protocols', href: '/protocols', icon: Users },
  { name: 'Docs', href: '/docs', icon: BookOpen },
]

export function Navbar() {
  const [isOpen, setIsOpen] = useState(false)

  return (
    <motion.nav
      initial={{ y: -100, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ duration: 0.6, ease: "easeOut" }}
      className="fixed top-0 left-0 right-0 z-50 glass-nav border-b border-white/10"
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo */}
          <Link href="/" className="flex items-center space-x-2 group">
            <motion.div
              whileHover={{ rotate: 360 }}
              transition={{ duration: 0.6 }}
              className="w-8 h-8 bg-gradient-to-r from-primary to-secondary rounded-lg flex items-center justify-center"
            >
              <Shield className="h-5 w-5 text-white" />
            </motion.div>
            <div className="flex flex-col">
              <span className="text-lg font-bold font-display bg-gradient-to-r from-primary to-secondary bg-clip-text text-transparent">
                CCR Hook
              </span>
              <Badge variant="outline" className="text-xs px-1 py-0 h-4 group-hover:bg-primary/10 transition-colors">
                BETA
              </Badge>
            </div>
          </Link>

          {/* Desktop Navigation */}
          <div className="hidden md:flex items-center space-x-1">
            {navigation.map((item) => {
              const Icon = item.icon
              return (
                <Link key={item.name} href={item.href}>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-foreground/80 hover:text-foreground hover:bg-white/10 transition-all duration-200"
                  >
                    <Icon className="h-4 w-4 mr-2" />
                    {item.name}
                  </Button>
                </Link>
              )
            })}
          </div>

          {/* Desktop Actions */}
          <div className="hidden md:flex items-center space-x-3">
            <ConnectButton
              accountStatus={{
                smallScreen: 'avatar',
                largeScreen: 'full',
              }}
              chainStatus={{
                smallScreen: 'icon',
                largeScreen: 'full',
              }}
              showBalance={{
                smallScreen: false,
                largeScreen: true,
              }}
            />
          </div>

          {/* Mobile Menu Button */}
          <div className="md:hidden">
            <Sheet open={isOpen} onOpenChange={setIsOpen}>
              <SheetTrigger asChild>
                <Button variant="ghost" size="sm">
                  <Menu className="h-5 w-5" />
                </Button>
              </SheetTrigger>
              <SheetContent side="right" className="glass-card border-white/20 w-80">
                <div className="flex flex-col space-y-4 mt-6">
                  {/* Mobile Logo */}
                  <div className="flex items-center space-x-2 pb-4 border-b border-white/20">
                    <div className="w-8 h-8 bg-gradient-to-r from-primary to-secondary rounded-lg flex items-center justify-center">
                      <Shield className="h-5 w-5 text-white" />
                    </div>
                    <span className="text-lg font-bold font-display bg-gradient-to-r from-primary to-secondary bg-clip-text text-transparent">
                      CCR Hook
                    </span>
                  </div>

                  {/* Mobile Navigation */}
                  <div className="space-y-2">
                    {navigation.map((item) => {
                      const Icon = item.icon
                      return (
                        <Link
                          key={item.name}
                          href={item.href}
                          onClick={() => setIsOpen(false)}
                        >
                          <Button
                            variant="ghost"
                            className="w-full justify-start text-foreground/80 hover:text-foreground hover:bg-white/10"
                          >
                            <Icon className="h-4 w-4 mr-3" />
                            {item.name}
                          </Button>
                        </Link>
                      )
                    })}
                  </div>

                  {/* Mobile Connect Button */}
                  <div className="pt-4 border-t border-white/20">
                    <ConnectButton
                      accountStatus="full"
                      chainStatus="full"
                      showBalance={true}
                    />
                  </div>
                </div>
              </SheetContent>
            </Sheet>
          </div>
        </div>
      </div>
    </motion.nav>
  )
}