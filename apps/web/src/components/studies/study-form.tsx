"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { Plus } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { useCreateStudy, useStudySources, useUpdateStudy } from "@/lib/queries";
import type { Study } from "@totalsegmentator-batch-pipeline/shared";

// Finite value sets are SELECTORS, not free text (see docs/features/studies.md).
const MODALITIES = ["CT", "MRI"] as const;
const TASKS_BY_MODALITY: Record<string, { value: string; label: string }[]> = {
  CT: [
    { value: "total", label: "Total — 100+ structures" },
    { value: "lung_vessels", label: "Lung vessels" },
    { value: "body", label: "Body regions" },
  ],
  MRI: [
    { value: "total_mr", label: "Total MR — MRI structures" },
    { value: "body", label: "Body regions" },
  ],
};
const DEFAULT_TASK: Record<string, string> = { CT: "total", MRI: "total_mr" };

const createSchema = z.object({
  study_id: z
    .string()
    .regex(
      /^[a-zA-Z0-9][a-zA-Z0-9._-]{0,127}$/,
      "Alphanumeric with -, _ or . (no slashes or spaces)",
    ),
  modality: z.enum(MODALITIES),
  task: z.enum(["total", "total_mr", "lung_vessels", "body"]),
  fast: z.boolean(),
  source_key: z.string().min(1, "Choose an ingested source volume"),
  description: z.string().max(280).optional(),
  patient_label: z.string().max(120).optional(),
});

type CreateValues = z.infer<typeof createSchema>;

export function NewStudyDialog() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const { data: sources = [] } = useStudySources({ enabled: open });
  const createStudy = useCreateStudy();

  const form = useForm<CreateValues>({
    resolver: zodResolver(createSchema),
    // Safe defaults for a sound first run (guidance only; no autofill button).
    defaultValues: {
      study_id: "demo-ct-001",
      modality: "CT",
      task: "total",
      fast: true,
      source_key: "",
      description: "",
      patient_label: "",
    },
  });

  const modality = form.watch("modality");

  // Guarantee `task` is always a valid, non-empty enum value for the current
  // modality. The RadioGroup handler below already sets a matching default on
  // change, but a re-render of the Task <Select> can race that write (its
  // option set is keyed off `modality` and briefly doesn't contain the old
  // task value), so this effect is the safety net that closes the gap —
  // without it, submitting right after switching modality could send task: ''
  // and fail Zod validation with no visible cause.
  useEffect(() => {
    const validTasks = TASKS_BY_MODALITY[modality].map((t) => t.value);
    if (!validTasks.includes(form.getValues("task"))) {
      form.setValue("task", DEFAULT_TASK[modality] as CreateValues["task"], {
        shouldValidate: true,
      });
    }
  }, [modality, form]);

  const onSubmit = async (values: CreateValues) => {
    try {
      await createStudy.mutateAsync({
        ...values,
        description: values.description || undefined,
        patient_label: values.patient_label || undefined,
      });
      toast.success(`Study "${values.study_id}" created`);
      setOpen(false);
      form.reset();
      // Land on the new study directly instead of leaving the user on the
      // list to find and click the row they just created.
      router.push(`/studies/${values.study_id}`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to create study");
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" className="h-8">
          <Plus className="h-3.5 w-3.5" />
          New study
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>New study</DialogTitle>
          <DialogDescription>
            Create a study from an ingested volume. Defaults below produce a sound
            first run — pick the bundled example volume if you have one.
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-5">
            <FormField
              control={form.control}
              name="study_id"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Study ID</FormLabel>
                  <FormControl>
                    <Input placeholder="demo-ct-001" {...field} />
                  </FormControl>
                  <FormDescription>The object-key prefix under studies/.</FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="modality"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Modality</FormLabel>
                  <FormControl>
                    <RadioGroup
                      value={field.value}
                      onValueChange={(value) => {
                        field.onChange(value);
                        // Keep the task valid for the chosen modality; the
                        // effect above is the safety net if this races a
                        // stale Select render.
                        form.setValue("task", DEFAULT_TASK[value] as CreateValues["task"], {
                          shouldValidate: true,
                        });
                      }}
                      className="flex gap-6"
                    >
                      {MODALITIES.map((m) => (
                        <label key={m} className="flex items-center gap-2 text-sm cursor-pointer">
                          <RadioGroupItem value={m} />
                          {m}
                        </label>
                      ))}
                    </RadioGroup>
                  </FormControl>
                  <FormDescription>Default: CT.</FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="task"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Task</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {TASKS_BY_MODALITY[modality].map((task) => (
                        <SelectItem key={task.value} value={task.value}>
                          {task.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormDescription>
                    Default: {DEFAULT_TASK[modality]} for {modality}.
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="fast"
              render={({ field }) => (
                <FormItem className="flex flex-row items-center justify-between rounded-md border border-border p-3">
                  <div className="space-y-0.5">
                    <FormLabel>Fast (3 mm)</FormLabel>
                    <FormDescription>
                      On by default — a demo run in minutes. Off runs full 1.5 mm.
                    </FormDescription>
                  </div>
                  <FormControl>
                    <Switch checked={field.value} onCheckedChange={field.onChange} />
                  </FormControl>
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="source_key"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Source volume</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Choose an ingested volume" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {sources.length === 0 ? (
                        <SelectItem value="__none" disabled>
                          No ingested volumes — upload one first
                        </SelectItem>
                      ) : (
                        sources.map((source) => (
                          <SelectItem key={source.key} value={source.key}>
                            {source.filename} ({source.size_human})
                          </SelectItem>
                        ))
                      )}
                    </SelectContent>
                  </Select>
                  <FormDescription>
                    Ingested NIfTI volumes from the Upload page.
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="patient_label"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Patient label (optional)</FormLabel>
                  <FormControl>
                    <Input placeholder="phantom-A" {...field} />
                  </FormControl>
                  <FormDescription>
                    A non-identifying label only — never real patient data.
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="description"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Description (optional)</FormLabel>
                  <FormControl>
                    <Textarea className="resize-none" placeholder="e.g. synthetic phantom" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <DialogFooter>
              <Button type="submit" disabled={createStudy.isPending}>
                {createStudy.isPending ? "Creating..." : "Create study"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}

const editSchema = z.object({
  description: z.string().max(280).optional(),
  patient_label: z.string().max(120).optional(),
});

type EditValues = z.infer<typeof editSchema>;

export function EditStudyDialog({ study }: { study: Study }) {
  const [open, setOpen] = useState(false);
  const updateStudy = useUpdateStudy(study.study_id);
  const form = useForm<EditValues>({
    resolver: zodResolver(editSchema),
    defaultValues: {
      description: study.description ?? "",
      patient_label: study.patient_label ?? "",
    },
  });

  // Re-fill when the underlying study changes (e.g. after a poll).
  useEffect(() => {
    if (open) {
      form.reset({
        description: study.description ?? "",
        patient_label: study.patient_label ?? "",
      });
    }
  }, [open, study, form]);

  const onSubmit = async (values: EditValues) => {
    try {
      await updateStudy.mutateAsync({
        description: values.description || undefined,
        patient_label: values.patient_label || undefined,
      });
      toast.success("Study updated");
      setOpen(false);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to update study");
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          Edit
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Edit study</DialogTitle>
          <DialogDescription>
            Modality, task and resolution are set at creation and are read-only here.
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-5">
            <FormField
              control={form.control}
              name="patient_label"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Patient label</FormLabel>
                  <FormControl>
                    <Input placeholder="phantom-A" {...field} />
                  </FormControl>
                  <FormDescription>Non-identifying label only.</FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="description"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Description</FormLabel>
                  <FormControl>
                    <Textarea className="resize-none" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <DialogFooter>
              <Button type="submit" disabled={updateStudy.isPending}>
                {updateStudy.isPending ? "Saving..." : "Save changes"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
