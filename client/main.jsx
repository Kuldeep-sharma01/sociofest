import React from "react";
import "./index.css";
import ReactDOM from "react-dom/client";
import { Provider } from "react-redux";
import { store } from "@/redux/store";
import App from "./App";
import { QueryClientProvider } from "@tanstack/react-query";
import queryClient from "@/lib/queryClient";
import { ThemeProvider } from "@/context/ThemeContext";
import { SocketProvider } from "@/context/SocketContext";
// wrap inside Provider → QueryClientProvider → ThemeProvider → SocketProvider → App

ReactDOM.createRoot(document.getElementById("root")).render(
  <Provider store={store}>
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <SocketProvider>
          <App /> 
        </SocketProvider>
      </ThemeProvider>
    </QueryClientProvider>
  </Provider>,
);

