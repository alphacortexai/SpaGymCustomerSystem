'use client';

import { useState, useEffect, useMemo, useRef } from 'react';
import Image from 'next/image';
import { useAuth } from '@/contexts/AuthContext';
import { useData } from '@/contexts/DataContext';
import { updateUserPreferences } from '@/lib/users';
import { getBirthdaysByMonth, getBirthdaysByMonthAndBranch } from '@/lib/clients';
import UserActivityHeatmap from './UserActivityHeatmap';
import { format, getDaysInMonth } from 'date-fns';
import dynamic from 'next/dynamic';

// Dynamically import ApexCharts to avoid SSR issues
const Chart = dynamic(() => import('react-apexcharts'), { ssr: false });

// Facebook blue color
const FACEBOOK_BLUE = '#1877F2';
const PURPLE = '#8b5cf6';

export default function NviewDashboard() {
  const { user, profile } = useAuth();
  const { 
    globalClients, 
    allBirthdays, 
    gymEnrollments, 
    spaEnrollments,
    branches,
    clientCountsByBranch
  } = useData();
  
  const [monthlyBirthdays, setMonthlyBirthdays] = useState({});
  const [monthlyBirthdaysByBranch, setMonthlyBirthdaysByBranch] = useState({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadMonthlyBirthdays();
  }, []);

  const loadMonthlyBirthdays = async () => {
    try {
      const currentMonth = new Date().getMonth() + 1; // 1-12
      const [birthdays, birthdaysByBranch] = await Promise.all([
        getBirthdaysByMonth(currentMonth),
        getBirthdaysByMonthAndBranch(currentMonth)
      ]);
      setMonthlyBirthdays(birthdays);
      setMonthlyBirthdaysByBranch(birthdaysByBranch);
    } catch (error) {
      console.error('Error loading monthly birthdays:', error);
    } finally {
      setLoading(false);
    }
  };

  // Calculate clients by branch
  const clientsByBranch = useMemo(() => {
    const branchCounts = {};
    branches.forEach(branch => {
      branchCounts[branch.name] = clientCountsByBranch?.[branch.name] || 0;
    });
    
    // Also count clients without branch
    const clientsWithoutBranch = globalClients.filter(c => !c.branch || !c.branch.trim()).length;
    if (clientsWithoutBranch > 0) {
      branchCounts['No Branch'] = clientsWithoutBranch;
    }
    
    const total = Object.values(branchCounts).reduce((sum, count) => sum + count, 0);
    const topBranch = Object.entries(branchCounts).sort((a, b) => b[1] - a[1])[0];
    
    return {
      total,
      branchCounts,
      topBranch: topBranch ? `${topBranch[0]}: ${topBranch[1]}` : 'N/A',
      distribution: Object.entries(branchCounts).map(([name, count]) => ({ name, count }))
    };
  }, [globalClients, branches, clientCountsByBranch]);

  // Calculate KPIs with background images mapping
  const kpis = useMemo(() => {
    const today = new Date();
    const activeGymMembers = gymEnrollments.filter(e => 
      e.status === 'active' && e.expiryDate && new Date(e.expiryDate) >= today
    ).length;
    
    const activeSpaMembers = spaEnrollments.filter(e => 
      e.status === 'active' && e.expiryDate && new Date(e.expiryDate) >= today
    ).length;

    const todaysBirthdays = allBirthdays.length;
    const totalClients = globalClients.length;

    return {
      clientsByBranch: {
        value: clientsByBranch.total,
        label: 'Total Clients',
        subtitle: clientsByBranch.topBranch,
        color: 'blue',
        icon: '👥',
        backgroundImage: '/clients_bg.png',
        distribution: clientsByBranch.distribution
      },
      todaysBirthdays: {
        value: todaysBirthdays,
        label: "Today's Birthdays",
        subtitle: 'Celebrating today',
        color: 'purple',
        icon: '🎂',
        backgroundImage: '/birthday.png'
      },
      spaMemberships: {
        value: activeSpaMembers,
        label: 'SPA Memberships',
        subtitle: 'Active members',
        color: 'purple',
        icon: '💆‍♀️',
        backgroundImage: '/spa_bg.jpg'
      },
      gymMemberships: {
        value: activeGymMembers,
        label: 'GYM Memberships',
        subtitle: 'Active members',
        color: 'blue',
        icon: '🏋️',
        backgroundImage: '/gym_bg.jpg'
      }
    };
  }, [globalClients, gymEnrollments, spaEnrollments, allBirthdays, clientsByBranch]);

  const getColorClasses = (color) => {
    const colors = {
      emerald: {
        bg: 'bg-emerald-50 dark:bg-emerald-900/20',
        text: 'text-emerald-700 dark:text-emerald-400',
        border: 'border-emerald-200 dark:border-emerald-800',
        chart: 'bg-emerald-500'
      },
      rose: {
        bg: 'bg-rose-50 dark:bg-rose-900/20',
        text: 'text-rose-700 dark:text-rose-400',
        border: 'border-rose-200 dark:border-rose-800',
        chart: 'bg-rose-500'
      },
      blue: {
        bg: 'bg-blue-50 dark:bg-blue-900/20',
        text: 'text-blue-700 dark:text-blue-400',
        border: 'border-blue-200 dark:border-blue-800',
        chart: 'bg-blue-500'
      },
      orange: {
        bg: 'bg-orange-50 dark:bg-orange-900/20',
        text: 'text-orange-700 dark:text-orange-400',
        border: 'border-orange-200 dark:border-orange-800',
        chart: 'bg-orange-500'
      }
    };
    return colors[color] || colors.blue;
  };

  // ApexCharts Pie/Donut chart component
  const PieChart = ({ data, colors, type = 'donut', size = 120 }) => {
    if (!data || data.length === 0) return null;
    
    const total = data.reduce((sum, item) => sum + item.count, 0);
    if (total === 0) return null;

    const chartOptions = {
      chart: {
        type: type,
        width: size,
        height: size,
        fontFamily: 'Inter, sans-serif',
        toolbar: {
          show: false,
        },
      },
      colors: colors,
      labels: data.map(item => item.name),
      dataLabels: {
        enabled: false,
      },
      legend: {
        show: false,
      },
      plotOptions: {
        pie: {
          donut: {
            size: type === 'donut' ? '70%' : '0%',
            labels: {
              show: true,
              name: {
                show: false,
              },
              value: {
                show: true,
                fontSize: '16px',
                fontFamily: 'Inter, sans-serif',
                fontWeight: 700,
                color: undefined,
                formatter: function (val) {
                  return total.toLocaleString();
                },
              },
              total: {
                show: false,
              },
            },
          },
        },
      },
      tooltip: {
        theme: 'dark',
        style: {
          fontSize: '12px',
          fontFamily: 'Inter, sans-serif',
        },
        y: {
          formatter: function (val, { seriesIndex }) {
            const percentage = ((val / total) * 100).toFixed(1);
            return `${data[seriesIndex].name}: ${val} (${percentage}%)`;
          },
        },
      },
      stroke: {
        show: true,
        width: 2,
        colors: ['#ffffff'],
      },
    };

    const chartSeries = data.map(item => item.count);

    return (
      <div className="flex items-center justify-center">
        <Chart
          options={chartOptions}
          series={chartSeries}
          type={type}
          width={size}
          height={size}
        />
      </div>
    );
  };

  // Generate birthday chart data for current month by branch
  const birthdayChartData = useMemo(() => {
    const now = new Date();
    const currentMonth = now.getMonth();
    const currentYear = now.getFullYear();
    const daysInMonth = getDaysInMonth(now);
    
    // Get all unique branches from the data
    const branchSet = new Set();
    Object.values(monthlyBirthdaysByBranch).forEach(dayData => {
      Object.keys(dayData).forEach(branch => branchSet.add(branch));
    });
    
    // Also include branches from the branches list if they're not in the data yet
    branches.forEach(branch => branchSet.add(branch.name));
    
    const allBranches = Array.from(branchSet);
    
    // Generate data points for each day
    const data = [];
    for (let day = 1; day <= daysInMonth; day++) {
      const dayData = monthlyBirthdaysByBranch[day] || {};
      const point = {
        day,
        date: format(new Date(currentYear, currentMonth, day), 'MMM d'),
        total: monthlyBirthdays[day] || 0
      };
      
      // Add count for each branch
      allBranches.forEach(branch => {
        point[branch] = dayData[branch] || 0;
      });
      
      data.push(point);
    }
    
    return { data, branches: allBranches };
  }, [monthlyBirthdays, monthlyBirthdaysByBranch, branches]);

  const maxBirthdayCount = Math.max(...birthdayChartData.data.map(d => d.total), 1);
  
  // Branch colors for line chart - using purple and Facebook blue variations
  const branchColors = [
    FACEBOOK_BLUE, // Facebook blue
    PURPLE, // Purple
    '#6366f1', // Indigo
    '#a855f7', // Purple light
    '#3b82f6', // Blue
    '#8b5cf6', // Purple medium
    '#7c3aed', // Purple dark
    '#6d28d9', // Purple darker
  ];

  const handleSwitchToStandard = async () => {
    if (user && profile?.role === 'Admin') {
      await updateUserPreferences(user.uid, { nviewEnabled: false });
      window.location.reload(); // Reload to apply changes
    }
  };

  return (
    <div className="space-y-8 pb-8">
      {/* Enhanced Header with Gradient */}
      <div className="relative overflow-hidden rounded-3xl card-bg-doc border border-slate-200/50 dark:border-slate-700/50 shadow-xl">
        {/* Decorative pattern overlay */}
        <div className="absolute inset-0 opacity-30 dark:opacity-10">
          <div className="absolute inset-0" style={{
            backgroundImage: `radial-gradient(circle at 1px 1px, rgba(148, 163, 184, 0.15) 1px, transparent 0)`,
            backgroundSize: '20px 20px'
          }}></div>
        </div>
        <div className="relative px-8 py-8 md:px-10 md:py-10">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-6">
            <div className="space-y-2">
              <div className="flex items-center gap-3">
                <div className="p-3 rounded-2xl shadow-lg" style={{ background: `linear-gradient(135deg, ${FACEBOOK_BLUE} 0%, ${PURPLE} 100%)` }}>
                  <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                  </svg>
                </div>
                <div>
                  <h1 className="text-4xl font-extrabold bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 dark:from-white dark:via-slate-100 dark:to-white bg-clip-text text-transparent">
                    Analytics Dashboard
                  </h1>
                  <p className="text-slate-600 dark:text-slate-300 mt-1 text-sm font-medium">
                    Comprehensive insights and performance metrics
                  </p>
                </div>
              </div>
            </div>
            <button
              onClick={handleSwitchToStandard}
              className="group relative px-6 py-3 bg-white/80 dark:bg-slate-800/80 backdrop-blur-sm hover:bg-white dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 text-sm font-semibold rounded-xl transition-all duration-200 flex items-center gap-2 shadow-lg hover:shadow-xl border border-slate-200/50 dark:border-slate-700/50"
            >
              <svg className="w-4 h-4 transition-transform group-hover:-translate-x-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
              </svg>
              Switch to Standard View
            </button>
          </div>
        </div>
      </div>

      {/* Enhanced KPI Cards with Background Images */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {Object.entries(kpis).map(([key, kpi], index) => {
          const isBlue = kpi.color === 'blue';
          const accentColor = isBlue ? FACEBOOK_BLUE : PURPLE;
          
          return (
            <div
              key={key}
              className="group relative overflow-hidden rounded-2xl border border-slate-200/60 dark:border-slate-700/60 shadow-lg hover:shadow-2xl transition-all duration-300 transform hover:-translate-y-1"
            >
              {/* Background Image */}
              {kpi.backgroundImage && (
                <div className="absolute inset-0 z-0">
                  <Image 
                    src={kpi.backgroundImage} 
                    alt={kpi.label} 
                    fill 
                    className="object-cover opacity-80 group-hover:opacity-100 transition-opacity duration-300" 
                  />
                  {/* Gradient overlay similar to old UI */}
                  <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/30 to-black/10 z-0" />
                </div>
              )}
              
              {/* Accent bar */}
              <div 
                className="absolute top-0 left-0 right-0 h-1 z-10"
                style={{ backgroundColor: accentColor }}
              ></div>
              
              <div className="relative p-6 z-10">
                <div className="flex items-start justify-between mb-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <div 
                        className="p-2 rounded-xl shadow-lg"
                        style={{ backgroundColor: accentColor }}
                      >
                        <span className="text-xl">{kpi.icon}</span>
                      </div>
                      <div className="text-xs font-semibold uppercase tracking-wider text-white opacity-90">
                        {kpi.label}
                      </div>
                    </div>
                    <div className="flex items-baseline gap-2 mb-2">
                      <div className="text-4xl font-extrabold text-white drop-shadow-lg">
                        {kpi.value.toLocaleString()}
                      </div>
                    </div>
                    {kpi.subtitle && (
                      <div className="text-xs font-medium text-white/80 mt-1 flex items-center gap-1">
                        <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-12a1 1 0 10-2 0v4a1 1 0 00.293.707l2.828 2.829a1 1 0 101.415-1.415L11 9.586V6z" clipRule="evenodd" />
                        </svg>
                        {kpi.subtitle}
                      </div>
                    )}
                    {kpi.distribution && kpi.distribution.length > 0 && (
                      <div className="mt-3 pt-3 border-t border-white/20">
                        <div className="space-y-1.5">
                          {kpi.distribution.slice(0, 3).map(({ name, count }) => {
                            const percentage = (count / kpi.value) * 100;
                            return (
                              <div key={name} className="flex items-center justify-between">
                                <span className="text-xs font-medium text-white/90">{name}</span>
                                <div className="flex items-center gap-2">
                                  <div className="w-16 h-1.5 bg-white/20 rounded-full overflow-hidden">
                                    <div 
                                      className="h-full rounded-full transition-all duration-500"
                                      style={{ 
                                        width: `${percentage}%`,
                                        backgroundColor: accentColor
                                      }}
                                    ></div>
                                  </div>
                                  <span className="text-xs font-bold text-white w-8 text-right">{count}</span>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
                
              {/* Enhanced ApexCharts Pie Chart */}
              {kpi.distribution && kpi.distribution.length > 0 ? (
                <div className="flex items-center justify-center mt-4 pt-4 border-t border-white/20">
                  <PieChart 
                    data={kpi.distribution} 
                    type="donut"
                    size={140}
                    colors={[
                      FACEBOOK_BLUE, PURPLE, '#a855f7', '#6366f1', 
                      '#3b82f6', '#8b5cf6', '#7c3aed', '#6d28d9'
                    ]}
                  />
                </div>
              ) : key === 'spaMemberships' || key === 'gymMemberships' ? (
                <div className="flex items-center justify-center mt-4 pt-4 border-t border-white/20">
                  <PieChart 
                    data={[
                      { name: key === 'spaMemberships' ? 'SPA' : 'GYM', count: kpi.value },
                      { name: 'Other', count: Math.max(0, clientsByBranch.total - kpi.value) }
                    ]} 
                    type="donut"
                    size={140}
                    colors={[accentColor, 'rgba(255, 255, 255, 0.3)']}
                  />
                </div>
              ) : null}
              </div>
            </div>
          );
        })}
      </div>

      {/* Enhanced Monthly Birthday Chart */}
      <div className="relative overflow-hidden rounded-3xl card-bg-doc border border-slate-200/60 dark:border-slate-700/60 shadow-xl">
        {/* Decorative gradient overlay */}
        <div className="absolute top-0 right-0 w-96 h-96 rounded-full blur-3xl -mr-48 -mt-48" style={{ 
          background: `radial-gradient(circle, ${FACEBOOK_BLUE}15 0%, ${PURPLE}10 50%, transparent 100%)` 
        }}></div>
        
        <div className="relative p-8">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between mb-8 gap-4">
            <div className="space-y-2">
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-xl shadow-lg" style={{ backgroundColor: PURPLE }}>
                  <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                </div>
                <div>
                  <h3 className="text-2xl font-bold text-slate-900 dark:text-white">Birthday Clients This Month</h3>
                  <p className="text-sm font-medium text-slate-500 dark:text-slate-400 mt-1 flex items-center gap-2">
                    <span>{format(new Date(), 'MMMM yyyy')}</span>
                    <span className="w-1 h-1 rounded-full bg-slate-400"></span>
                    <span>Daily birthday distribution by branch</span>
                  </p>
                </div>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <div className="px-4 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
                <div className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Total</div>
                <div className="text-lg font-bold text-slate-900 dark:text-white">
                  {Object.values(monthlyBirthdays).reduce((sum, count) => sum + count, 0)}
                </div>
              </div>
              <button className="p-2.5 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-colors border border-slate-200 dark:border-slate-700">
                <svg className="w-5 h-5 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 5v.01M12 12v.01M12 19v.01M12 6a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2z" />
                </svg>
              </button>
            </div>
          </div>
        
          {loading ? (
            <div className="h-80 flex items-center justify-center">
              <div className="flex flex-col items-center gap-3">
                <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
                <div className="text-sm font-medium text-slate-500 dark:text-slate-400">Loading birthday data...</div>
              </div>
            </div>
          ) : (
            <div className="relative">
              {/* ApexCharts Line Chart */}
              {birthdayChartData.branches.length > 0 && (
                <Chart
                  options={{
                    chart: {
                      type: 'line',
                      height: 400,
                      fontFamily: 'Inter, sans-serif',
                      toolbar: {
                        show: false,
                      },
                      zoom: {
                        enabled: false,
                      },
                      dropShadow: {
                        enabled: true,
                        color: '#000',
                        top: 18,
                        left: 7,
                        blur: 10,
                        opacity: 0.2,
                      },
                    },
                    colors: branchColors.slice(0, birthdayChartData.branches.length),
                    dataLabels: {
                      enabled: false,
                    },
                    stroke: {
                      curve: 'smooth',
                      width: 3,
                    },
                    grid: {
                      borderColor: '#e5e7eb',
                      strokeDashArray: 4,
                      xaxis: {
                        lines: {
                          show: false,
                        },
                      },
                      yaxis: {
                        lines: {
                          show: true,
                        },
                      },
                      padding: {
                        top: 0,
                        right: 0,
                        bottom: 0,
                        left: 0,
                      },
                    },
                    markers: {
                      size: 5,
                      hover: {
                        size: 7,
                      },
                    },
                    xaxis: {
                      categories: birthdayChartData.data.map(point => point.day),
                      labels: {
                        style: {
                          colors: '#6b7280',
                          fontSize: '12px',
                          fontFamily: 'Inter, sans-serif',
                        },
                        formatter: function (val, opts) {
                          const day = parseInt(val);
                          const isToday = day === new Date().getDate();
                          return isToday ? `<strong style="color: #10b981;">${day}</strong>` : day;
                        },
                      },
                      axisBorder: {
                        show: false,
                      },
                      axisTicks: {
                        show: false,
                      },
                    },
                    yaxis: {
                      labels: {
                        style: {
                          colors: '#6b7280',
                          fontSize: '12px',
                          fontFamily: 'Inter, sans-serif',
                        },
                      },
                    },
                    tooltip: {
                      theme: 'dark',
                      style: {
                        fontSize: '12px',
                        fontFamily: 'Inter, sans-serif',
                      },
                      y: {
                        formatter: function (val, { seriesIndex }) {
                          return `${birthdayChartData.branches[seriesIndex]}: ${val} birthdays`;
                        },
                      },
                    },
                    legend: {
                      show: true,
                      position: 'bottom',
                      horizontalAlign: 'left',
                      floating: false,
                      fontSize: '12px',
                      fontFamily: 'Inter, sans-serif',
                      fontWeight: 500,
                      offsetY: 0,
                      labels: {
                        colors: '#6b7280',
                      },
                      markers: {
                        width: 12,
                        height: 12,
                        radius: 12,
                      },
                    },
                    fill: {
                      type: 'gradient',
                      gradient: {
                        shade: 'light',
                        type: 'vertical',
                        shadeIntensity: 0.3,
                        gradientToColors: branchColors.slice(0, birthdayChartData.branches.length).map(color => color + '80'),
                        inverseColors: false,
                        opacityFrom: 0.4,
                        opacityTo: 0.1,
                        stops: [0, 100],
                      },
                    },
                  }}
                  series={birthdayChartData.branches.map(branch => ({
                    name: branch,
                    data: birthdayChartData.data.map(point => point[branch] || 0),
                  }))}
                  type="area"
                  height={400}
                />
              )}
              
              {/* Enhanced Legend */}
              <div className="mt-6 pt-6 border-t border-slate-200 dark:border-slate-700">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                  <div className="flex items-center gap-6 flex-wrap">
                    <div className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                      Branch Totals:
                    </div>
                    {birthdayChartData.branches.map((branch, index) => {
                      const color = branchColors[index % branchColors.length];
                      const totalForBranch = birthdayChartData.data.reduce((sum, point) => sum + (point[branch] || 0), 0);
                      return (
                        <div key={branch} className="flex items-center gap-2 group cursor-pointer hover:opacity-80 transition-opacity">
                          <div 
                            className="w-4 h-4 rounded shadow-sm group-hover:scale-110 transition-transform" 
                            style={{ backgroundColor: color }}
                          ></div>
                          <span className="text-sm font-medium text-slate-700 dark:text-slate-300">{branch}</span>
                          <span className="text-xs font-bold text-slate-500 dark:text-slate-400 px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800">
                            {totalForBranch}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* User Activity Heatmap */}
      <UserActivityHeatmap />
    </div>
  );
}
