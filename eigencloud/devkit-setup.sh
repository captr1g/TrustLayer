#!/bin/bash

# EigenLayer Devkit CLI Setup and Integration Script
# This script sets up the official EigenLayer Devkit CLI for CCR Hook AVS

set -e

echo "========================================="
echo "   EigenLayer Devkit CLI Setup          "
echo "========================================="

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Check if devkit-cli is installed
check_devkit_installed() {
    if command -v devkit &> /dev/null; then
        echo -e "${GREEN}✓ EigenLayer Devkit CLI is installed${NC}"
        devkit --version
        return 0
    else
        echo -e "${YELLOW}! EigenLayer Devkit CLI not found${NC}"
        return 1
    fi
}

# Install devkit-cli
install_devkit() {
    echo "Installing EigenLayer Devkit CLI..."

    # Method 1: Using npm (recommended)
    if command -v npm &> /dev/null; then
        echo "Installing via npm..."
        npm install -g @eigenlayer/devkit-cli

    # Method 2: Using curl
    elif command -v curl &> /dev/null; then
        echo "Installing via curl..."
        curl -sSfL https://raw.githubusercontent.com/Layr-Labs/devkit-cli/main/install.sh | sh

    # Method 3: Clone and build from source
    else
        echo "Installing from source..."
        git clone https://github.com/Layr-Labs/devkit-cli.git /tmp/devkit-cli
        cd /tmp/devkit-cli
        make install
        cd -
    fi

    echo -e "${GREEN}✓ Installation complete${NC}"
}

# Initialize AVS project
initialize_avs() {
    echo -e "\n${YELLOW}Initializing CCR Hook AVS project...${NC}"

    # Create devkit directory if it doesn't exist
    mkdir -p devkit
    cd devkit

    # Initialize new AVS project
    devkit init ccr-hook-avs \
        --type avs \
        --network sepolia \
        --framework foundry

    echo -e "${GREEN}✓ AVS project initialized${NC}"
}

# Configure AVS
configure_avs() {
    echo -e "\n${YELLOW}Configuring CCR Hook AVS...${NC}"

    # Create AVS configuration
    cat > avs.config.yaml << 'EOF'
# EigenLayer Devkit Configuration for CCR Hook AVS
name: ccr-hook-avs
version: 1.0.0
description: Confidential Credit Risk Hook AVS for Uniswap v4

# AVS Type and Network
type: avs
network: sepolia
framework: foundry

# Service Configuration
service:
  name: CCRServiceManager
  registry: 0x0000000000000000000000000000000000000000

# Operator Requirements
operators:
  minOperators: 3
  maxOperators: 21
  minStake: 32000000000000000000  # 32 ETH
  quorumThreshold: 66  # 66%

# Task Definitions
tasks:
  - name: computePCS
    type: offchain_compute
    timeout: 30
    gasLimit: 500000

  - name: computePRS
    type: offchain_compute
    timeout: 20
    gasLimit: 400000

  - name: batchAttestation
    type: batch_compute
    timeout: 60
    gasLimit: 1000000

# Slashing Conditions
slashing:
  enabled: true
  conditions:
    - type: invalid_computation
      penalty: 10  # 10% of stake
    - type: timeout
      penalty: 5   # 5% of stake
    - type: censorship
      penalty: 20  # 20% of stake

# Endpoints
endpoints:
  rpc: ${RPC_URL}
  eigenlayer:
    slasher: ${SLASHER_ADDRESS}
    delegation: ${DELEGATION_ADDRESS}
    strategy: ${STRATEGY_ADDRESS}

# Docker Configuration
docker:
  image: ccr-hook/avs-operator
  registry: registry.eigenlayer.xyz

# Monitoring
monitoring:
  prometheus: true
  grafana: true
  port: 9090
EOF

    echo -e "${GREEN}✓ AVS configuration created${NC}"
}

# Generate contracts using devkit
generate_contracts() {
    echo -e "\n${YELLOW}Generating EigenLayer contracts...${NC}"

    # Generate service manager contract
    devkit generate contract \
        --type service-manager \
        --name CCRServiceManager \
        --output ../contracts/generated/

    # Generate registry contracts
    devkit generate contract \
        --type registry-coordinator \
        --output ../contracts/generated/

    devkit generate contract \
        --type stake-registry \
        --output ../contracts/generated/

    echo -e "${GREEN}✓ Contracts generated${NC}"
}

# Deploy contracts using devkit
deploy_contracts() {
    echo -e "\n${YELLOW}Deploying contracts to network...${NC}"

    # Deploy AVS contracts
    devkit deploy \
        --config avs.config.yaml \
        --network sepolia \
        --private-key ${DEPLOYER_PRIVATE_KEY}

    echo -e "${GREEN}✓ Contracts deployed${NC}"
}

# Register operator using devkit
register_operator() {
    echo -e "\n${YELLOW}Registering operator...${NC}"

    # Register as operator
    devkit operator register \
        --config avs.config.yaml \
        --private-key ${OPERATOR_PRIVATE_KEY} \
        --stake 32

    echo -e "${GREEN}✓ Operator registered${NC}"
}

# Start operator node
start_operator() {
    echo -e "\n${YELLOW}Starting operator node...${NC}"

    # Start operator service
    devkit operator start \
        --config avs.config.yaml \
        --metrics \
        --port 8080

    echo -e "${GREEN}✓ Operator node started${NC}"
}

# Create Docker setup for devkit
create_docker_setup() {
    echo -e "\n${YELLOW}Creating Docker setup...${NC}"

    # Create docker-compose for devkit
    cat > docker-compose.devkit.yml << 'EOF'
version: '3.8'

services:
  # EigenLayer Devkit Operator
  devkit-operator:
    image: eigenlayer/devkit:latest
    container_name: ccr-hook-devkit
    environment:
      - NETWORK=sepolia
      - OPERATOR_PRIVATE_KEY=${OPERATOR_PRIVATE_KEY}
      - RPC_URL=${RPC_URL}
      - SERVICE_MANAGER_ADDRESS=${SERVICE_MANAGER_ADDRESS}
    volumes:
      - ./avs.config.yaml:/app/config/avs.config.yaml
      - ./data:/app/data
      - ./logs:/app/logs
    ports:
      - "8080:8080"  # Operator API
      - "9090:9090"  # Metrics
    command: ["operator", "start", "--config", "/app/config/avs.config.yaml"]
    restart: unless-stopped
    networks:
      - eigenlayer

  # AVS Worker Service (integrates with devkit)
  avs-worker:
    build: ../../avs-worker
    container_name: ccr-avs-worker
    environment:
      - NODE_ENV=production
      - PORT=3000
      - OPERATOR_PRIVATE_KEY=${OPERATOR_PRIVATE_KEY}
      - DEVKIT_URL=http://devkit-operator:8080
    depends_on:
      - devkit-operator
    ports:
      - "3000:3000"
    networks:
      - eigenlayer

  # Monitoring Stack
  prometheus:
    image: prom/prometheus:latest
    container_name: ccr-prometheus
    volumes:
      - ./monitoring/prometheus.yml:/etc/prometheus/prometheus.yml
      - prometheus-data:/prometheus
    ports:
      - "9091:9090"
    networks:
      - eigenlayer

  grafana:
    image: grafana/grafana:latest
    container_name: ccr-grafana
    environment:
      - GF_SECURITY_ADMIN_PASSWORD=admin
    volumes:
      - ./monitoring/grafana:/etc/grafana/provisioning
      - grafana-data:/var/lib/grafana
    ports:
      - "3001:3000"
    networks:
      - eigenlayer

networks:
  eigenlayer:
    driver: bridge

volumes:
  prometheus-data:
  grafana-data:
EOF

    echo -e "${GREEN}✓ Docker setup created${NC}"
}

# Create devkit CLI wrapper
create_cli_wrapper() {
    echo -e "\n${YELLOW}Creating CLI wrapper...${NC}"

    # Create wrapper script
    cat > ccr-avs << 'EOF'
#!/bin/bash
# CCR Hook AVS CLI Wrapper for EigenLayer Devkit

case "$1" in
    init)
        devkit init ccr-hook-avs --type avs --network ${2:-sepolia}
        ;;
    deploy)
        devkit deploy --config avs.config.yaml --network ${2:-sepolia}
        ;;
    register)
        devkit operator register --config avs.config.yaml --stake ${2:-32}
        ;;
    start)
        devkit operator start --config avs.config.yaml --metrics
        ;;
    stop)
        devkit operator stop
        ;;
    status)
        devkit operator status --config avs.config.yaml
        ;;
    logs)
        devkit operator logs --follow
        ;;
    task)
        devkit task create --type ${2:-computePCS} --data ${3}
        ;;
    monitor)
        devkit monitor --config avs.config.yaml
        ;;
    *)
        echo "Usage: ./ccr-avs {init|deploy|register|start|stop|status|logs|task|monitor}"
        exit 1
        ;;
esac
EOF

    chmod +x ccr-avs
    echo -e "${GREEN}✓ CLI wrapper created${NC}"
}

# Main setup flow
main() {
    echo -e "${YELLOW}Starting EigenLayer Devkit setup...${NC}\n"

    # Check if devkit is installed
    if ! check_devkit_installed; then
        install_devkit
    fi

    # Run setup steps
    initialize_avs
    configure_avs
    generate_contracts
    create_docker_setup
    create_cli_wrapper

    echo -e "\n${GREEN}=========================================${NC}"
    echo -e "${GREEN}   EigenLayer Devkit Setup Complete!    ${NC}"
    echo -e "${GREEN}=========================================${NC}"

    echo -e "\nNext steps:"
    echo -e "1. Set environment variables in .env:"
    echo -e "   - OPERATOR_PRIVATE_KEY"
    echo -e "   - DEPLOYER_PRIVATE_KEY"
    echo -e "   - RPC_URL"
    echo -e "   - SERVICE_MANAGER_ADDRESS"

    echo -e "\n2. Deploy contracts:"
    echo -e "   ${YELLOW}cd devkit && ./ccr-avs deploy${NC}"

    echo -e "\n3. Register as operator:"
    echo -e "   ${YELLOW}./ccr-avs register${NC}"

    echo -e "\n4. Start operator node:"
    echo -e "   ${YELLOW}./ccr-avs start${NC}"

    echo -e "\n5. Monitor status:"
    echo -e "   ${YELLOW}./ccr-avs status${NC}"

    echo -e "\nFor Docker deployment:"
    echo -e "   ${YELLOW}docker-compose -f docker-compose.devkit.yml up${NC}"
}

# Run main function
main "$@"