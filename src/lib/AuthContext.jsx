import React, {
  createContext,
  useState,
  useContext,
  useEffect,
} from "react";

import api from "@/api/auth";

const AuthContext = createContext(null);

// 周期静默同步间隔：每 60 秒拉一次 /me，
// 用于自动同步 VIP 状态（到期后无需刷新页面即可自动锁定）
const AUTH_SYNC_INTERVAL_MS = 60 * 1000;

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(() => {
    try {
      const savedUser = localStorage.getItem("user");
      return savedUser ? JSON.parse(savedUser) : null;
    } catch (error) {
      console.error("读取本地用户信息失败:", error);
      return null;
    }
  });

  const [token, setToken] = useState(
    () => localStorage.getItem("token")
  );

  const [isAuthenticated, setIsAuthenticated] =
    useState(() => !!localStorage.getItem("token"));

  const [isLoadingAuth, setIsLoadingAuth] =
    useState(true);

  // ============================================================
  // 同步用户到 React + localStorage
  // ============================================================

  const saveUser = (nextUser) => {
    setUser(nextUser);

    if (nextUser) {
      localStorage.setItem(
        "user",
        JSON.stringify(nextUser)
      );
    } else {
      localStorage.removeItem("user");
    }
  };

  // ============================================================
  // 初始化检查登录状态
  // ============================================================

  useEffect(() => {
    const checkAuth = async () => {
      const savedToken =
        localStorage.getItem("token");

      if (!savedToken) {
        setToken(null);
        setUser(null);
        setIsAuthenticated(false);
        setIsLoadingAuth(false);
        return;
      }

      try {
        const res = await api.get("/auth/me");

        const currentUser =
          res.data?.user;

        if (!currentUser) {
          throw new Error(
            "用户信息不存在"
          );
        }

        setToken(savedToken);
        saveUser(currentUser);
        setIsAuthenticated(true);

      } catch (error) {
        console.error(
          "检查登录状态失败:",
          error
        );

        localStorage.removeItem("token");
        localStorage.removeItem("user");

        setToken(null);
        setUser(null);
        setIsAuthenticated(false);

      } finally {
        setIsLoadingAuth(false);
      }
    };

    checkAuth();
  }, []);

  // ============================================================
  // 周期静默同步用户状态
  // （每 60 秒拉一次 /me；切回标签页时立即同步，
  //   让 VIP 到期后的锁定自动恢复，无需手动刷新页面）
  // ============================================================

  useEffect(() => {
    if (!isAuthenticated) return;

    let cancelled = false;

    const sync = async () => {
      if (cancelled) return;

      try {
        const res = await api.get("/auth/me");
        const currentUser = res.data?.user;

        if (currentUser) {
          saveUser(currentUser);
        }
      } catch (error) {
        // 静默失败：不打断用户，等下次同步
        // token 失效时静默登出，避免一直带着过期状态
        if (error?.response?.status === 401) {
          localStorage.removeItem("token");
          localStorage.removeItem("user");
          setToken(null);
          setUser(null);
          setIsAuthenticated(false);
        }
      }
    };

    const timer = setInterval(
      sync,
      AUTH_SYNC_INTERVAL_MS
    );

    // 切回标签页时立即同步一次
    const onVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        sync();
      }
    };

    document.addEventListener(
      "visibilitychange",
      onVisibilityChange
    );

    return () => {
      cancelled = true;
      clearInterval(timer);
      document.removeEventListener(
        "visibilitychange",
        onVisibilityChange
      );
    };
  }, [isAuthenticated]);

  // ============================================================
  // 登录
  // ============================================================

  const login = (data) => {
    const {
      token: newToken,
      user: newUser,
    } = data;

    if (!newToken || !newUser) {
      console.error(
        "登录返回数据异常:",
        data
      );
      return;
    }

    localStorage.setItem(
      "token",
      newToken
    );

    setToken(newToken);

    saveUser(newUser);

    setIsAuthenticated(true);
  };

  // ============================================================
  // 更新完整用户资料
  // ============================================================

  const updateUser = (updatedUser) => {
    if (!updatedUser) return;

    setUser((currentUser) => {
      const mergedUser = {
        ...(currentUser || {}),
        ...updatedUser,
      };

      localStorage.setItem(
        "user",
        JSON.stringify(mergedUser)
      );

      return mergedUser;
    });
  };

  // ============================================================
  // 刷新用户信息（从后端重新拉取，用于 VIP 激活后同步）
  // ============================================================

  const refreshUser = async () => {
    const savedToken =
      localStorage.getItem("token");

    if (!savedToken) return null;

    try {
      const res = await api.get("/auth/me");
      const currentUser = res.data?.user;

      if (currentUser) {
        saveUser(currentUser);
        return currentUser;
      }

      return null;
    } catch (error) {
      console.error(
        "刷新用户信息失败:",
        error
      );
      return null;
    }
  };

  // ============================================================
  // 更新头像
  // ============================================================

  const updateAvatar = (avatar) => {
    if (!avatar) return;

    setUser((currentUser) => {
      if (!currentUser) return currentUser;

      const updatedUser = {
        ...currentUser,
        avatar,
      };

      localStorage.setItem(
        "user",
        JSON.stringify(updatedUser)
      );

      return updatedUser;
    });
  };

  // ============================================================
  // 更新昵称
  // ============================================================

  const updateNickname = (nickname) => {
    if (nickname === undefined) return;

    setUser((currentUser) => {
      if (!currentUser) return currentUser;

      const updatedUser = {
        ...currentUser,
        nickname,
      };

      localStorage.setItem(
        "user",
        JSON.stringify(updatedUser)
      );

      return updatedUser;
    });
  };

  // ============================================================
  // 退出登录
  // ============================================================

  const logout = async () => {
    try {
      if (localStorage.getItem("token")) {
        await api.post("/auth/logout");
      }
    } catch (error) {
      console.warn(
        "退出接口调用失败:",
        error
      );
    }

    localStorage.removeItem("token");
    localStorage.removeItem("user");

    setToken(null);
    setUser(null);
    setIsAuthenticated(false);

    window.location.href = "/login";
  };

  // ============================================================
  // Context
  // ============================================================

  return (
    <AuthContext.Provider
      value={{
        user,
        token,

        isAuthenticated,
        isLoadingAuth,

        login,
        logout,

        updateUser,
        updateAvatar,
        updateNickname,
        refreshUser,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

// ============================================================
// useAuth
// ============================================================

export const useAuth = () => {
  const context =
    useContext(AuthContext);

  if (!context) {
    throw new Error(
      "useAuth must be used inside AuthProvider"
    );
  }

  return context;
};