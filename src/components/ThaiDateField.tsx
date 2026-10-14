import { useEffect, useId, useRef, useState } from "react";
import { CalendarDays, ChevronLeft, ChevronRight } from "lucide-react";
import { formatBuddhistInput, parseBuddhistDate } from "../lib/buddhist";
const MONTHS = ["มกราคม","กุมภาพันธ์","มีนาคม","เมษายน","พฤษภาคม","มิถุนายน","กรกฎาคม","สิงหาคม","กันยายน","ตุลาคม","พฤศจิกายน","ธันวาคม"];
const DOW = ["อา","จ","อ","พ","พฤ","ศ","ส"];
const pad = (v: number) => String(v).padStart(2,"0");
type Props = {label:string;value:string;onChange:(value:string)=>void;required?:boolean;name?:string;withTime?:boolean};
export function ThaiDateField({label,value,onChange,required=false,name,withTime=false}:Props){
 const id=useId(),root=useRef<HTMLDivElement>(null),input=useRef<HTMLInputElement>(null);
 const [display,setDisplay]=useState(()=>formatBuddhistInput(value));
 const [time,setTime]=useState(()=>value.slice(11,16));
 const [open,setOpen]=useState(false);
 const [year,setYear]=useState(()=>Number(value.slice(0,4))||new Date().getFullYear());
 const [month,setMonth]=useState(()=>value?Number(value.slice(5,7))-1:new Date().getMonth());
 const invalid=display.length>0 && parseBuddhistDate(display)===null;
 useEffect(()=>{setDisplay(formatBuddhistInput(value));setTime(value.slice(11,16));},[value]);
 useEffect(()=>{input.current?.setCustomValidity(invalid?"กรุณากรอกวันที่ พ.ศ. ให้ถูกต้อง":"");},[invalid]);
 useEffect(()=>{if(!open)return;const close=(e:MouseEvent)=>{if(!root.current?.contains(e.target as Node))setOpen(false);};const escape=(e:KeyboardEvent)=>{if(e.key==="Escape")setOpen(false);};document.addEventListener("mousedown",close);document.addEventListener("keydown",escape);return()=>{document.removeEventListener("mousedown",close);document.removeEventListener("keydown",escape);};},[open]);
 const emit=(text:string,t:string)=>{const iso=parseBuddhistDate(text);onChange(iso&&(!withTime||/^\d{2}:\d{2}$/.test(t))?iso+(withTime?"T"+t:""):"");};
 const pick=(day:number)=>{const text=pad(day)+"/"+pad(month+1)+"/"+(year+543);setDisplay(text);emit(text,time);setOpen(false);};
 const shift=(step:number)=>{const n=new Date(year,month+step,1);setYear(n.getFullYear());setMonth(n.getMonth());};
 const offset=new Date(year,month,1).getDay(),days=new Date(year,month+1,0).getDate();
 const cells=[...Array<null>(offset).fill(null),...Array.from({length:days},(_,i)=>i+1)];
 return <div className="field thai-date-field" ref={root}>
  <label htmlFor={id}>{label}{required&&" *"}</label>
  {name&&<input type="hidden" name={name} value={value}/>}
  <div className="thai-date-input-wrap"><input ref={input} id={id} type="text" inputMode="numeric" autoComplete="off" required={required} maxLength={10} pattern="[0-9๐-๙]{1,2}/[0-9๐-๙]{1,2}/[0-9๐-๙]{4}" placeholder="วว/ดด/พ.ศ." value={display} aria-invalid={invalid} onChange={e=>{e.currentTarget.setCustomValidity("");setDisplay(e.target.value);emit(e.target.value,time);}}/>
  <button type="button" className="thai-calendar-toggle" aria-label={"เลือกวันที่ "+label} onClick={()=>{if(!open&&parseBuddhistDate(display)){const iso=parseBuddhistDate(display)!;setYear(Number(iso.slice(0,4)));setMonth(Number(iso.slice(5,7))-1);}setOpen(!open);}}><CalendarDays size={18}/></button></div>
  {withTime&&<input aria-label={"เวลา "+label} type="time" value={time} required={required} onChange={e=>{setTime(e.target.value);emit(display,e.target.value);}}/>}
  {invalid&&<small style={{color:"#b42318"}}>กรุณากรอกวันที่จริงในรูปแบบ วว/ดด/พ.ศ.</small>}
  {open&&<div role="dialog" aria-label={"ปฏิทิน "+label} className="thai-calendar">
   <div className="thai-calendar-heading"><button type="button" aria-label="เดือนก่อนหน้า" onClick={()=>shift(-1)}><ChevronLeft size={18}/></button>
    <select aria-label="เดือน" value={month} onChange={e=>setMonth(Number(e.target.value))}>{MONTHS.map((m,i)=><option key={m} value={i}>{m}</option>)}</select>
    <select aria-label="ปี พ.ศ." value={year+543} onChange={e=>setYear(Number(e.target.value)-543)}>{Array.from({length:401},(_,i)=>2800-i).map(y=><option key={y} value={y}>{y}</option>)}</select>
    <button type="button" aria-label="เดือนถัดไป" onClick={()=>shift(1)}><ChevronRight size={18}/></button></div>
   <div className="thai-calendar-grid">{DOW.map(x=><span key={x} className="thai-calendar-weekday">{x}</span>)}{cells.map((day,i)=>day?<button type="button" key={i} className={parseBuddhistDate(display)===year+"-"+pad(month+1)+"-"+pad(day)?"selected":""} onClick={()=>pick(day)}>{day}</button>:<span key={i}/>)}</div>
   <div className="thai-calendar-footer"><span>ปีพุทธศักราช (พ.ศ.)</span><button type="button" onClick={()=>{setDisplay("");emit("",time);setOpen(false);}}>ล้างวันที่</button></div>
  </div>}
 </div>;
}
