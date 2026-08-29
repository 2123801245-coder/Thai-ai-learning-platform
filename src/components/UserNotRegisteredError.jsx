import React from "react";
import { Link } from "react-router-dom";

const UserNotRegisteredError = () => {
  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-gradient-to-b from-white to-slate-50">

      <div className="max-w-md w-full p-8 bg-white rounded-lg shadow-lg border border-slate-100">

        <div className="text-center">

          <div className="inline-flex items-center justify-center w-16 h-16 mb-6 rounded-full bg-orange-100">

            <svg
              className="w-8 h-8 text-orange-600"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >

              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2"
                d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
              />

            </svg>

          </div>


          <h1 className="text-3xl font-bold text-slate-900 mb-4">
            账号不存在
          </h1>


          <p className="text-slate-600 mb-8">
            当前账号还没有注册 AI 泰语教师账户，请先注册后再登录。
          </p>



          <div className="space-y-3">


            <Link
              to="/register"
              className="block w-full py-3 rounded-lg bg-primary text-white font-medium hover:opacity-90"
            >
              立即注册
            </Link>



            <Link
              to="/login"
              className="block w-full py-3 rounded-lg border border-slate-200 text-slate-700 font-medium hover:bg-slate-50"
            >
              返回登录
            </Link>


          </div>



          <div className="mt-6 p-4 bg-slate-50 rounded-md text-sm text-slate-600">

            <p>
              如果你已经注册：
            </p>

            <ul className="list-disc list-inside mt-2 space-y-1">

              <li>
                检查登录邮箱是否正确
              </li>

              <li>
                尝试退出后重新登录
              </li>

              <li>
                确认邮箱验证码已完成验证
              </li>

            </ul>


          </div>


        </div>


      </div>


    </div>
  );
};


export default UserNotRegisteredError;