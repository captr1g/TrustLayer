# CCR Hook - Confidential Credit Risk for DeFi

A privacy-preserving credit scoring system for Uniswap v4, enabling better swap conditions while protecting user financial data through Fully Homomorphic Encryption (FHE).

## 🚀 Features

- **Privacy-First Design**: Your financial data never leaves your device
- **FHE Encryption**: Computation on encrypted data using Fhenix technology
- **Decentralized Validation**: EigenLayer AVS network for secure attestations
- **Gamified Experience**: XP system, achievements, and credit tier progression
- **Modern UI/UX**: Glassmorphism design with smooth animations
- **Mobile-First**: Responsive design optimized for all devices

## 🛠 Tech Stack

### Frontend Framework
- **Next.js 15** - Latest with App Router and Turbopack
- **React 19** - Latest stable version
- **TypeScript** - Full type safety

### Styling & UI
- **Tailwind CSS 4** - Latest utility-first CSS framework
- **shadcn/ui** - High-quality component library
- **Framer Motion 12** - Premium animations and interactions
- **Radix UI** - Accessibility-first primitives

### Web3 Integration
- **wagmi v2** - React hooks for Ethereum
- **RainbowKit v2** - Wallet connection UI
- **viem v2** - TypeScript interface for Ethereum

### Design System
- **Inter & Playfair Display** - Professional typography
- **Glassmorphism** - Modern glass-like UI elements
- **CCR Brand Colors** - Teal (#0EA5A4) & Violet (#7C3AED)
- **8px Grid System** - Consistent spacing

## 🎨 Design Highlights

### Glassmorphism Components
- Semi-transparent backgrounds with backdrop blur
- Subtle borders and shadows for depth
- Hover effects with smooth transitions

### Credit Tier System
- Bronze, Silver, Gold, Platinum, Diamond tiers
- Visual tier progression with color-coded badges
- Tier-based benefits and access controls

### Privacy-First UX
- Clear data handling explanations
- Encryption status indicators
- Local-first data processing

## 📱 Components

### Core Components

#### AttestationCard
- Displays user credit score and tier
- Shows attestation validity and expiration
- Actions for publishing and downloading
- Privacy status indicators

#### PoolCard
- Pool information with TVL and volume
- Credit tier access requirements
- User-specific benefits display
- Swap simulation integration

#### XPProgress
- Circular progress with level display
- Achievement badges showcase
- Progress to next level tracking
- Gamification elements

### Page Sections

#### HeroSection
- Animated value proposition
- Interactive demo preview
- Trust indicators and partnerships
- Call-to-action buttons

#### HowItWorksSection
- 4-step process explanation
- Visual flow with animations
- Privacy guarantees highlighted

#### FeaturesSection
- Feature cards with categories
- Comparison with alternatives
- Interactive hover effects

#### TrustSection
- Partnership showcase
- Metrics and testimonials
- Final CTA with social proof

## 🚀 Getting Started

### Prerequisites
- Node.js 18+
- npm or yarn

### Installation

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd ccr-hook-webapp
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Set up environment variables**
   ```bash
   cp .env.example .env.local
   ```

   Add your WalletConnect project ID:
   ```
   NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID=your_project_id_here
   ```

4. **Run the development server**
   ```bash
   npm run dev
   ```

5. **Open your browser**
   Navigate to [http://localhost:3001](http://localhost:3001)

## 📖 Documentation

### Project Structure
```
src/
├── app/                    # Next.js App Router pages
│   ├── demo/              # Interactive demo page
│   ├── globals.css        # Global styles with design tokens
│   └── layout.tsx         # Root layout with providers
├── components/
│   ├── ccr/               # CCR Hook specific components
│   ├── navigation/        # Navigation components
│   ├── sections/          # Landing page sections
│   ├── ui/                # shadcn/ui components
│   └── providers.tsx      # Web3 and React Query providers
└── lib/
    ├── types.ts           # TypeScript type definitions
    ├── utils.ts           # Utility functions
    └── wagmi.ts           # Web3 configuration
```

### Design Tokens
- **Colors**: Primary teal, secondary violet, tier-specific colors
- **Typography**: Inter for UI, Playfair Display for headings
- **Spacing**: 8px grid system with consistent scaling
- **Animations**: Subtle and purposeful motion design

### Component API
All components are fully typed with TypeScript and documented with JSDoc comments. See individual component files for detailed prop interfaces.

## 🔧 Development

### Scripts
- `npm run dev` - Start development server with Turbopack
- `npm run build` - Build for production
- `npm run start` - Start production server
- `npm run lint` - Run ESLint

### Code Quality
- ESLint configuration for Next.js
- TypeScript strict mode enabled
- Consistent code formatting
- Component composition patterns

## 🎯 Current Status

### ✅ Completed
- Modern tech stack with latest versions
- Glassmorphism design system
- Core UI components (AttestationCard, PoolCard, XPProgress)
- Landing page with animated sections
- Interactive demo page
- Web3 wallet integration
- Responsive navigation
- TypeScript type definitions

### 🔄 Next Steps
- cofhejs FHE implementation
- AVS operator integration
- Smart contract deployment
- Pool registry integration
- Performance optimization
- Accessibility compliance (WCAG 2.2 AA)

## 🤝 Contributing

We welcome contributions! Please see our contributing guidelines for more details.

### Development Guidelines
- Follow the existing code style
- Write TypeScript interfaces for all props
- Use semantic commit messages
- Test components thoroughly

## 📄 License

This project is licensed under the MIT License - see the LICENSE file for details.

## 🙏 Acknowledgments

- **EigenLayer** - AVS infrastructure
- **Fhenix** - FHE technology
- **Uniswap** - v4 hook integration
- **shadcn** - Component library inspiration
- **Vercel** - Deployment platform

---

**Built with ❤️ for the future of private DeFi**

For questions or support, please open an issue or reach out to the team.
