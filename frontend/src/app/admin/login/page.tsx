'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Form, Input, Button, Card, message, Typography } from 'antd'
import { UserOutlined, LockOutlined } from '@ant-design/icons'
import { authService } from '@/lib/authService'

const { Title } = Typography

export default function LoginPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (values: { username: string; password: string }) => {
    try {
      setLoading(true)
      const { user } = await authService.login(values.username, values.password)
      message.success(`Chào mừng ${user.fullName || user.username}!`)
      router.push('/admin/dashboard')
    } catch (err) {
      message.error(err instanceof Error ? err.message : 'Đăng nhập thất bại')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{
      display: 'flex',
      justifyContent: 'center',
      alignItems: 'center',
      minHeight: '100vh',
      background: '#ffffff'
    }}>
      <Card
        style={{
          width: 400,
          boxShadow: '0 10px 40px rgba(0,0,0,0.2)'
        }}
      >
        <div style={{ textAlign: 'center', marginBottom: 30 }}>
          <Title level={2} style={{ color: '#EE4D2D', marginBottom: 8 }}>
            Shopee Affiliate
          </Title>
          <p style={{ color: '#666', fontSize: 14 }}>
            Hệ thống quản lý chiến dịch Facebook Marketing
          </p>
        </div>
        
        <Form
          name="login"
          onFinish={handleSubmit}
          autoComplete="off"
          size="large"
        >
          <Form.Item
            name="username"
            rules={[
              { required: true, message: 'Vui lòng nhập username!' }
            ]}
          >
            <Input
              prefix={<UserOutlined />}
              placeholder="Username"
              autoFocus
            />
          </Form.Item>
          
          <Form.Item
            name="password"
            rules={[
              { required: true, message: 'Vui lòng nhập password!' }
            ]}
          >
            <Input.Password
              prefix={<LockOutlined />}
              placeholder="Password"
            />
          </Form.Item>
          
          <Form.Item>
            <Button
              type="primary"
              htmlType="submit"
              loading={loading}
              block
              style={{
                height: 45,
                fontSize: 16,
                fontWeight: 600,
                background: '#EE4D2D',
                borderColor: '#EE4D2D'
              }}
            >
              Đăng nhập
            </Button>
          </Form.Item>
        </Form>
      </Card>
    </div>
  )
}
