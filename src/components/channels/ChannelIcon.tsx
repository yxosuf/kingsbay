 import { cn } from '@/lib/utils';
 
 interface ChannelIconProps {
   type: string;
   size?: 'sm' | 'md' | 'lg';
   className?: string;
 }
 
 // Styled channel icons with brand-appropriate colors matching the UI theme
 export function ChannelIcon({ type, size = 'md', className }: ChannelIconProps) {
   const sizeClasses = {
     sm: 'w-6 h-6 text-xs',
     md: 'w-10 h-10 text-sm',
     lg: 'w-12 h-12 text-base',
   };
 
   const getIconContent = () => {
     switch (type) {
       case 'booking_com':
         return (
           <div className={cn(
             'rounded-lg flex items-center justify-center font-bold bg-[#003580] text-white',
             sizeClasses[size],
             className
           )}>
             <svg viewBox="0 0 24 24" className="w-3/5 h-3/5" fill="currentColor">
               <path d="M12.24 7.27c1.66 0 2.92.51 3.77 1.53.86 1.02 1.29 2.47 1.29 4.35 0 1.95-.44 3.47-1.31 4.55-.88 1.08-2.13 1.62-3.75 1.62-1.62 0-2.87-.54-3.75-1.62-.88-1.08-1.31-2.6-1.31-4.55 0-1.88.43-3.33 1.29-4.35.85-1.02 2.11-1.53 3.77-1.53zm0 9.52c.8 0 1.4-.32 1.8-.95.4-.64.6-1.55.6-2.74 0-1.12-.2-1.99-.6-2.61-.4-.62-1-.93-1.8-.93s-1.4.31-1.8.93c-.4.62-.6 1.49-.6 2.61 0 1.19.2 2.1.6 2.74.4.63 1 .95 1.8.95zM4.5 7.5h5.4c1.3 0 2.26.28 2.88.84.62.56.93 1.38.93 2.46 0 .76-.16 1.38-.48 1.86-.32.48-.78.82-1.38 1.02v.06c.78.18 1.36.52 1.74 1.02.38.5.57 1.14.57 1.92 0 1.1-.35 1.96-1.05 2.58-.7.62-1.68.93-2.94.93H4.5V7.5zm2.4 4.86h2.16c.66 0 1.14-.14 1.44-.42.3-.28.45-.7.45-1.26 0-.52-.16-.92-.48-1.2-.32-.28-.8-.42-1.44-.42H6.9v3.3zm0 5.04h2.52c.68 0 1.18-.16 1.5-.48.32-.32.48-.76.48-1.32 0-.58-.17-1.02-.51-1.32-.34-.3-.85-.45-1.53-.45H6.9v3.57z"/>
             </svg>
           </div>
         );
       
       case 'airbnb':
         return (
           <div className={cn(
             'rounded-lg flex items-center justify-center bg-[#FF5A5F] text-white',
             sizeClasses[size],
             className
           )}>
             <svg viewBox="0 0 24 24" className="w-3/5 h-3/5" fill="currentColor">
               <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8zm-2.5-5.5c-.83 0-1.5-.67-1.5-1.5s.67-1.5 1.5-1.5 1.5.67 1.5 1.5-.67 1.5-1.5 1.5zm5 0c-.83 0-1.5-.67-1.5-1.5s.67-1.5 1.5-1.5 1.5.67 1.5 1.5-.67 1.5-1.5 1.5zM12 17.5c-2.33 0-4.31-1.46-5.11-3.5h10.22c-.8 2.04-2.78 3.5-5.11 3.5z"/>
             </svg>
           </div>
         );
       
       case 'agoda':
         return (
           <div className={cn(
             'rounded-lg flex items-center justify-center bg-[#5392F9] text-white font-bold',
             sizeClasses[size],
             className
           )}>
             <span className="text-[0.6em] font-extrabold tracking-tight">ago</span>
           </div>
         );
       
       case 'expedia':
         return (
           <div className={cn(
             'rounded-lg flex items-center justify-center bg-[#FFD205] text-[#1C1C1C] font-bold',
             sizeClasses[size],
             className
           )}>
             <svg viewBox="0 0 24 24" className="w-3/5 h-3/5" fill="currentColor">
               <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 15H7v-2h4v2zm4-4H7v-2h8v2zm0-4H7V7h8v2z"/>
             </svg>
           </div>
         );
       
       case 'direct':
         return (
           <div className={cn(
             'rounded-lg flex items-center justify-center bg-primary text-primary-foreground',
             sizeClasses[size],
             className
           )}>
             <svg viewBox="0 0 24 24" className="w-3/5 h-3/5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
               <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>
               <polyline points="9 22 9 12 15 12 15 22"/>
             </svg>
           </div>
         );
       
       case 'other_ota':
       default:
         return (
           <div className={cn(
             'rounded-lg flex items-center justify-center bg-muted text-muted-foreground',
             sizeClasses[size],
             className
           )}>
             <svg viewBox="0 0 24 24" className="w-3/5 h-3/5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
               <circle cx="12" cy="12" r="10"/>
               <line x1="2" y1="12" x2="22" y2="12"/>
               <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/>
             </svg>
           </div>
         );
     }
   };
 
   return getIconContent();
 }