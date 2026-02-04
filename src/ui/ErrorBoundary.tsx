import React from "react"
import { Box, Text } from "ink"
import { isDebugEnabled } from "../core/logger"

type ErrorBoundaryState = {
  error: Error | null
}

export class ErrorBoundary extends React.Component<{ children: React.ReactNode }, ErrorBoundaryState> {
  state: ErrorBoundaryState = { error: null }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { error }
  }

  render() {
    if (this.state.error) {
      return (
        <Box flexDirection="column" paddingX={1} paddingY={1}>
          <Text color="red">UI 发生错误，请退出后重试</Text>
          {isDebugEnabled() ? (
            <Text dimColor>{this.state.error.stack ?? this.state.error.message}</Text>
          ) : null}
        </Box>
      )
    }
    return this.props.children
  }
}
